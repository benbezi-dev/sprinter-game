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
import { LEG, ELAN, type EtatRelais, type Ecouteurs, type JoueurRelais, type Zone } from './salle-relais';

const TAILLE: number = TAILLE_SERVEUR;
const ARRIVEE: number = ARRIVEE_SERVEUR;
const PORTEE: number = PORTEE_SERVEUR;

/** Le temps de se mettre en place, comme la vraie salle. */
const AVANT_DEPART_MS = 5000;
/** Dix-huit images par seconde de simulation suffisent ; l'ecran interpole. */
const PAS_MS = 50;
/**
 * Au-dela, la course s'arrete. Un 4 x 100 dure une quarantaine de secondes ;
 * deux minutes, c'est qu'il ne se passe plus rien — le jeu en pause, un
 * porteur qui ne court plus — et la salle ne doit pas tourner sans fin.
 */
const DUREE_MAX_MS = 120000;

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
const MARQUE_FICTIF = 5;    // m dans la zone, ou le receveur fictif attend
const CONTACT = 1.0;        // m : deux fictifs se passent le temoin a cette distance

/**
 * LE RECORD PERSO, PAR PLACE.
 *
 * Une course solo ne compte pas au classement des equipes : sans rien a battre,
 * on la courait une fois. Le meilleur temps a chaque place reste donc sur le
 * telephone — c'est un repere pour soi, pas un classement, et il n'a aucune
 * raison de partir au serveur.
 */
const CLE_RECORDS = 'sprinter.relais.solo.records';

function lireRecords(): Record<string, number> {
  try {
    const o = JSON.parse(localStorage.getItem(CLE_RECORDS) || '{}');
    return o && typeof o === 'object' ? o : {};
  } catch { return {}; }
}

export function recordSolo(rang: number): number | null {
  const v = Number(lireRecords()[String(rang)]);
  return Number.isFinite(v) && v > 0 ? v : null;
}

/** Note un temps ; dit s'il bat le record, et quel etait l'ancien. */
export function noterRecordSolo(rang: number, ms: number): { nouveau: boolean; avant: number | null } {
  const avant = recordSolo(rang);
  const nouveau = avant == null || ms < avant;
  if (nouveau) {
    try {
      const o = lireRecords(); o[String(rang)] = Math.round(ms);
      localStorage.setItem(CLE_RECORDS, JSON.stringify(o));
    } catch { /* sans memoire, le record vit le temps de l'ecran */ }
  }
  return { nouveau, avant };
}

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
  /** Fermee : plus rien ne part vers l'ecran, plus rien ne s'y accepte. */
  private fermee = false;
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
    setTimeout(() => { if (!this.fermee) this.etat(); }, 0);
  }

  pret(v: boolean) {
    if (this.fermee) return;
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
    if (this.departA || this.fermee) return;
    // La marque retenue est celle que la course accepte, bornee a la zone :
    // c'est elle que la piste dessine et d'ou le moteur fait partir le joueur.
    if (this.course.placer(this.monRelais, d)) {
      this.marque = this.course.coureur(this.monRelais).d;
      this.etat();
    }
  }

  msCourse(): number {
    return this.departA ? Date.now() - this.departA : 0;
  }

  position(d: number, c?: number) {
    if (!this.departA || this.course.finie() || this.fermee) return;
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
    // Retenu seulement si la course l'accepte : une arrivee refusee (le
    // temoin pas encore la, une position en retard) se retente a la position
    // suivante au lieu de laisser la course sans fin.
    this.finEnvoyee = this.fini(this.msCourse());
  }

  /** Vrai quand la course est close, par l'arrivee ou par l'elimination. */
  fini(ms: number): boolean {
    if (this.fermee) return true;
    const r = this.course.terminer(this.monRelais, ms, this.msCourse());
    if (r.elimine) { this.eliminer(r.elimine); return true; }
    if (r.total != null) { this.finir(); return true; }
    return false;
  }

  /**
   * Ma tape. Mon partenaire fictif tend la main avec moi — a quelques
   * centiemes pres, comme un vrai coequipier — mais seulement s'il est a
   * portee : un fictif ne tape pas dans le vide.
   */
  temoin() {
    const c = this.course;
    if (!this.departA || c.finie() || this.fermee) return;
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
    // LE PASSAGE HORS ZONE ELIMINE, MEME SEUL (l'auteur, 14/11/2026 : « si le
    // relais n'est pas donne ou recu dans la zone de transmission alors il est
    // hors zone et l'equipe est eliminee »). Le coequipier fictif tend la main
    // avec le joueur, ou qu'ils soient : c'est CourseEquipe.taper qui juge, et
    // un temoin donne avant la zone ou passe au-dela l'elimine, comme dans la
    // salle en ligne. Le fictif ne sauve plus le joueur d'une tape trop tot.
    c.taper(moi, maintenant);
    const r = c.taper(partenaire, maintenant + 30 + Math.random() * 90);
    this.traiterTape(r);
  }

  fauxDepart() {
    if (this.monRelais === 1 && !this.fermee) {
      const el = this.course.eliminer('faux depart', 1);
      if (el) this.eliminer(el);
    }
  }

  /**
   * Ou chaque receveur de l'equipe pose sa marque d'elan : la sienne pour le
   * joueur (sa place moins ELAN), celles des fictifs a leur place a eux. La
   * piste les dessine, pour qu'on voie ou chacun partira.
   */
  marquesElan(): { relais: number; d: number }[] {
    const m: { relais: number; d: number }[] = [];
    for (let r = 2; r <= TAILLE; r++) {
      const place = r === this.monRelais ? this.marque : zoneDe(r).debut + MARQUE_FICTIF;
      m.push({ relais: r, d: place - ELAN });
    }
    return m;
  }

  /**
   * Fermer pour de bon. Les ecouteurs sont coupes : un etat tardif (le
   * `connecter` differe, un double montage en mode strict) ne doit plus
   * toucher le moteur — il y deplacerait le temoin d'une course finie.
   */
  fermer() {
    this.fermee = true;
    this.arreter();
    this.ec = {};
  }

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

  /**
   * Ou un porteur fictif se tient pour tendre le temoin au joueur : derriere
   * lui, a portee de main, et toujours DANS la zone de transmission.
   */
  private pointDuPorteur(p: number): number {
    const dR = this.course.coureur(p + 1).d;
    return Math.max(dR - CONTACT - 0.2, zoneDe(p + 1).debut + 0.3);
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
    //
    // Il vise un point, pas un ecart : un metre deux derriere le joueur, MAIS
    // JAMAIS AVANT L'ENTREE DE LA ZONE (PR #109). Un joueur qui attend a
    // l'arret sur sa marque par defaut — l'entree meme de la zone — voyait
    // sinon le fictif s'arreter un metre avant elle : sa tape aurait donne le
    // temoin hors zone, et elimine l'equipe sans qu'il ait rien fait de mal.
    if (f.relais === p) {
      f.parti = true;
      if (p < TAILLE && p + 1 === this.monRelais) {
        const reste = this.pointDuPorteur(p) - d;
        if (reste < 15) {
          return Math.min(f.vmax + 1.5, Math.max(0, this.moiV + reste * 2));
        }
      }
      return f.vmax;
    }
    return 0;
  }

  /**
   * UN TOUR DE MINUTEUR, DECOUPE EN PETITS PAS.
   *
   * Le minuteur ne tombe pas toujours toutes les 50 ms : un telephone charge,
   * un onglet passe en arriere-plan, et il revient apres une seconde. Borner
   * le pas a 0,2 s faisait alors PERDRE ce temps aux fictifs — l'horloge de
   * l'equipe continuait, eux non, et le chrono s'allongeait de leur faute. On
   * rattrape donc tout le temps ecoule (jusqu'a deux secondes), par pas de
   * 50 ms au plus pour garder une course et des transmissions justes.
   */
  private pas() {
    const c = this.course;
    if (!this.departA || c.finie()) { this.arreter(); return; }
    const maintenant = Date.now();
    const ecoule = Math.min(2, Math.max(0, (maintenant - this.dernierPas) / 1000));
    this.dernierPas = maintenant;
    const t = maintenant - this.departA;
    if (t < 0) return;
    if (t > DUREE_MAX_MS) {
      const el = c.eliminer('temps depasse', c.porteur);
      if (el) this.eliminer(el);
      return;
    }
    const n = Math.max(1, Math.ceil(ecoule / (PAS_MS / 1000)));
    const dt = ecoule / n;
    for (let k = n - 1; k >= 0; k--) {
      // L'instant de ce petit pas, sur l'horloge de l'equipe.
      const tk = Math.max(0, t - k * dt * 1000);
      if (!this.petitPas(dt, tk, maintenant - k * dt * 1000)) return;
    }
    // Les positions partent une fois par tour : l'ecran interpole.
    for (const f of this.fictifs) this.ec.onPos?.(f.relais, c.coureur(f.relais).d, t);
  }

  /** Un petit pas de simulation. Faux quand la course vient de s'arreter. */
  private petitPas(dt: number, t: number, horloge: number): boolean {
    const c = this.course;
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
      const avant = cour.d;
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
      // UN PORTEUR FICTIF NE VA PAS AU BOUT DE SA ZONE avec le temoin : il
      // attend que son receveur le prenne. Atteindre le bout eliminerait
      // l'equipe (relais-course.js) pour une faute que seul le joueur peut
      // commettre, en ne tendant pas la main.
      if (f.relais === c.porteur && c.porteur < TAILLE) {
        const bord = zoneDe(c.porteur + 1).fin - 0.5;
        d = Math.min(d, Math.max(avant, bord));
        // NI DEVANT UN RECEVEUR HUMAIN. Le reglage d'allure (`cible`) le
        // ralentit a l'approche, mais un joueur qui reste a sa marque se
        // faisait doubler : le fictif repartait a pleine vitesse une fois
        // devant, et allait finir au bout de la zone. Il reste derriere lui,
        // a portee de main, et attend qu'il parte ou qu'il tape.
        if (c.porteur + 1 === this.monRelais) {
          // Collé derriere lui, mais jamais avant l'entree de la zone : la
          // tape doit toujours tomber dans la zone (voir pointDuPorteur).
          const derriere = Math.max(c.coureur(this.monRelais).d - 0.8,
                                    zoneDe(c.porteur + 1).debut + 0.3);
          if (d > derriere) {
            d = Math.max(avant, derriere);
            f.v = Math.min(f.v, Math.max(0, this.moiV));
          }
        }
      }
      // Sans instant annonce : la salle ecrete sans eliminer, et un fictif
      // reste toujours sous le plafond de vitesse.
      const r = c.avancer(f.relais, d, t);
      if (r.elimine) { this.eliminer(r.elimine); return false; }

      if (f.relais === TAILLE && c.porteur === TAILLE && c.coureur(TAILLE).d >= ARRIVEE) {
        // L'instant exact ou il a franchi la ligne, et non celui du pas : a
        // dix metres par seconde, 50 ms font un demi-metre.
        const parcouru = Math.max(1e-6, c.coureur(TAILLE).d - avant);
        const deborde = c.coureur(TAILLE).d - ARRIVEE;
        const tFin = Math.round(t - (deborde / parcouru) * dt * 1000);
        const fin4 = c.terminer(TAILLE, tFin, t);
        if (fin4.elimine) { this.eliminer(fin4.elimine); return false; }
        if (fin4.total != null) { this.finir(); return false; }
      }
    }

    // Deux fictifs au contact se passent le temoin d'eux-memes.
    const p = c.porteur;
    if (p < TAILLE && p !== this.monRelais && p + 1 !== this.monRelais) {
      const a = c.coureur(p).d, b = c.coureur(p + 1).d;
      const z = zoneDe(p + 1);
      if (Math.abs(a - b) <= CONTACT && a >= z.debut && b >= z.debut) {
        c.taper(p, horloge);
        this.traiterTape(c.taper(p + 1, horloge + 20 + Math.random() * 60));
        if (c.finie()) return false;
      }
    }
    return true;
  }
}
