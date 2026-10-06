// LES ENTREES DES BOSS — chacun la sienne, et celle de sa culture.
//
// L'auteur, le 06/10 : « les boss doivent avoir des entrees et presentations
// propres a eux et a leurs cultures », puis « une presentation et un
// comportement propre a chacun ». L'entree d'Aurel Manga (entrerEnBoss,
// engine.ts) etait une seule et meme demarche suivie d'un seul geste ; ici,
// chaque boss a sa CHOREGRAPHIE : comment il arrive (en crabe, du ciel, en
// dansant...), le geste qu'il fait a la ligne, et le moment ou il parle.
//
// COMMENT CA BOUGE. Le moteur sait imposer une posture membre par membre
// (`r.posture`, pose() dans sprinter-core.js : angles absolus, 0 le membre vers
// le bas, positif vers l'avant ; le buste negatif vers l'avant ; la tete
// positive le menton leve ; le roulis des bras positif vers l'axe du corps).
// Une choregraphie est une suite de postures-cles dans le temps, que l'on
// interpole ; la marche reprend celle d'Aurel (`r.marche`), le deplacement se
// pose sur `r.d` (le long du couloir), `r.demi` (en travers) et `r.cap` (ou
// regarde le corps). `bras[1]` est le bras droit, celui que la camera voit.
//
// CE QUI MANQUE, ET QUI VIENDRA AVEC LES MAILLAGES TRIPO : les objets — le
// masque de renard, la montre a gousset, le foulard, la torche. Les gestes
// sont deja ceux qui les tiendront.

import { SprinterApp } from '../engine';
import type { Lieu } from './etapes';

type V2 = [number, number];
type V3 = [number, number, number];

export type Posture = {
  jambes: [V3, V3];
  bras: [V2, V2];
  buste: number;
  leve: number;
  tete: number;
  roule: V2;
};

/** Debout, au repos : les jambes et les bras de `debout` (attitude(), sprinter-core.js). */
const DEBOUT: Posture = {
  jambes: [[0.07, 0.05, 0], [-0.07, -0.05, 0]],
  bras: [[0.06, 0.28], [0.06, 0.28]],
  buste: 0.02, leve: 0, tete: 0.05, roule: [0, 0],
};

type Partielle = {
  jambes?: [V3, V3]; bras?: [V2, V2]; brasG?: V2; brasD?: V2;
  buste?: number; leve?: number; tete?: number; roule?: V2;
};

/** Une posture complete, a partir du repos et de ce qui change. */
function p(o: Partielle): Posture {
  const bras: [V2, V2] = o.bras ? [o.bras[0], o.bras[1]] : [DEBOUT.bras[0], DEBOUT.bras[1]];
  if (o.brasG) bras[0] = o.brasG;
  if (o.brasD) bras[1] = o.brasD;
  return {
    jambes: o.jambes || DEBOUT.jambes, bras,
    buste: o.buste ?? DEBOUT.buste, leve: o.leve ?? DEBOUT.leve,
    tete: o.tete ?? DEBOUT.tete, roule: o.roule || DEBOUT.roule,
  };
}

const doux = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); };
const mel = (a: number, b: number, u: number) => a + (b - a) * u;

function melanger(a: Posture, b: Posture, u: number): Posture {
  const v2 = (x: V2, y: V2): V2 => [mel(x[0], y[0], u), mel(x[1], y[1], u)];
  const v3 = (x: V3, y: V3): V3 => [mel(x[0], y[0], u), mel(x[1], y[1], u), mel(x[2], y[2], u)];
  return {
    jambes: [v3(a.jambes[0], b.jambes[0]), v3(a.jambes[1], b.jambes[1])],
    bras: [v2(a.bras[0], b.bras[0]), v2(a.bras[1], b.bras[1])],
    buste: mel(a.buste, b.buste, u), leve: mel(a.leve, b.leve, u),
    tete: mel(a.tete, b.tete, u), roule: v2(a.roule, b.roule),
  };
}

/** Une cle : a l'instant `t`, la posture `p` (ou une posture qui vit, fonction du temps). */
type Cle = { t: number; p: Posture | ((t: number) => Posture) };

/** La posture a l'instant `t`, entre les deux cles qui l'encadrent. */
function entre(cles: Cle[], t: number): Posture {
  const at = (c: Cle) => (typeof c.p === 'function' ? c.p(t) : c.p);
  if (t <= cles[0].t) return at(cles[0]);
  for (let i = 1; i < cles.length; i++) {
    if (t <= cles[i].t) {
      const a = cles[i - 1], b = cles[i];
      return melanger(at(a), at(b), doux((t - a.t) / Math.max(1e-6, b.t - a.t)));
    }
  }
  return at(cles[cles.length - 1]);
}

/* ---------------------------------------------------------------------------
   LE DEPLACEMENT
   --------------------------------------------------------------------------- */

// La marche d'Aurel : 1,95 pas par seconde a 1,85 m/s (ENTREE, engine.ts).
const PAS_PAR_S = 1.95, VITESSE_PAS = 1.85;

// Le chemin d'Aurel, pour la meme raison : vu d'en haut et de biais, un
// coureur un couloir plus a l'exterieur se tient a l'ecran juste au-dessus de
// lui. On longe donc ses blocs par l'interieur (`ECART`), et l'on revient dans
// l'axe du couloir a l'approche de la ligne.
const ECART = 1.15, LONGE = -3.2, REJOINT = -1.5;
function ecartDuChemin(depuis: number, d: number): number {
  const ecarte = doux((d - depuis) / (LONGE - depuis));
  const revient = doux((d - REJOINT) / (0 - REJOINT));
  return -ECART * ecarte * (1 - revient);
}

/**
 * Marcher de `depuis` a `vers` entre les instants t0 et t1 : la position le long
 * du couloir, en travers, l'orientation du corps et le pas. Rend le poids de
 * la marche (1 en chemin, 0 avant et apres).
 */
function marcher(r: any, t: number, dt: number, t0: number, t1: number, depuis: number, vers: number,
                 chemin = true): number {
  const u = Math.max(0, Math.min(1, (t - t0) / (t1 - t0)));
  // depart et arrivee adoucis : on ne se met pas en marche d'un coup
  const avant = r.d;
  r.d = mel(depuis, vers, doux(u));
  const v = dt > 0 ? Math.abs(r.d - avant) / dt : 0;
  if (chemin) {
    const pente = (ecartDuChemin(depuis, r.d + 0.05) - ecartDuChemin(depuis, r.d - 0.05)) / 0.1;
    r.demi = ecartDuChemin(depuis, r.d);
    r.cap = Math.atan(pente);
  }
  r.marcheT = (r.marcheT || 0) + dt * Math.PI * PAS_PAR_S * (v / VITESSE_PAS);
  return t >= t0 && t < t1 ? 1 : 0;
}

/* ---------------------------------------------------------------------------
   LES DIX CHOREGRAPHIES
   ---------------------------------------------------------------------------
   `duree` : quand le boss rend la main au decompte. `bulle` : la fenetre ou il
   parle. `plan` / `visee` : le cadrage, quand celui d'Aurel ne convient pas
   (celui qui descend du ciel doit se voir AVANT de toucher la piste).
   `jouer(r, t, dt)` pose le corps a l'instant t.
--------------------------------------------------------------------------- */

type Choregraphie = {
  duree: number;
  bulle: [number, number];
  plan?: number;
  visee?: number;
  jouer: (r: any, t: number, dt: number) => void;
};

/** Le geste d'Aurel, en posture : le bras droit tendu vers l'arrivee. */
const POINTE = p({ jambes: [[0.09, 0.07, 0], [-0.09, -0.07, 0]], brasG: [-0.04, 0.14], brasD: [1.66, 1.70],
                   buste: 0.04, tete: 0.14 });

/** Poser le corps : la posture `pose`, au poids `w`, et la marche au poids `wm`. */
function poser(r: any, pose: Posture, w: number, wm = 0) {
  r.posture = { w, ...pose };
  r.marche = wm;
  r.pointe = 0;
  r.debout = 0;
}

const CHOREGRAPHIES: Record<string, Choregraphie> = {

  // KOUASSI « LE CRABE » — San-Pedro. Il arrive de cote, accroupi, les deux
  // bras en pinces qui claquent, en petits pas chasses : le crabe de la plage.
  // A la ligne il se redresse, se tourne vers l'arrivee et la montre, hilare.
  crabe: {
    duree: 5.6, bulle: [3.2, 5.6],
    jouer(r, t, dt) {
      const pince = (u: number): Posture => {
        const pas = Math.sin(u * Math.PI * 2 * 3.0);
        const clac = 0.5 + 0.5 * Math.sin(u * Math.PI * 2 * 4.0);
        return p({
          jambes: [[0.55 + 0.12 * pas, -0.30 + 0.10 * pas, 0.12], [0.45 - 0.12 * pas, -0.42 - 0.10 * pas, 0.12]],
          bras: [[1.25, 2.35], [1.25, 2.35]], roule: [-0.30 + 0.30 * clac, 0.70 * clac],
          buste: -0.18, leve: -0.10 + 0.015 * Math.abs(pas), tete: 0.10,
        });
      };
      const cles: Cle[] = [
        { t: 0, p: pince }, { t: 2.6, p: pince },
        { t: 3.1, p: DEBOUT }, { t: 3.5, p: POINTE }, { t: 5.0, p: POINTE }, { t: 5.5, p: DEBOUT },
      ];
      // en travers du couloir, face a la camera, de -5 m jusqu'a la ligne, par
      // le chemin d'Aurel (qui evite les jambes du couloir 6 a l'ecran)
      const u = Math.max(0, Math.min(1, t / 2.6));
      r.d = mel(-5.0, 0, doux(u));
      r.demi = ecartDuChemin(-5.0, r.d);
      r.cap = t < 2.6 ? -1.30 : mel(-1.30, 0, doux((t - 2.6) / 0.5));
      poser(r, entre(cles, t), 1);
    },
  },

  // SORA KANZAKI « KITSUNE » — Kyoto. Il marche sans hate, s'arrete a la ligne,
  // les pieds joints, et salue d'une reverence (le rei, trente degres, les mains
  // le long des cuisses). Il se redresse, ferme les yeux un instant, puis les
  // rouvre sur l'arrivee.
  reverence: {
    duree: 7.6, bulle: [5.4, 7.6],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 3.6, -6.2, 0);
      const joints = p({ jambes: [[0, 0, 0], [0, 0, 0]], bras: [[0.0, 0.03], [0.0, 0.03]], tete: 0.02 });
      const rei = p({ jambes: [[0, 0, 0], [0, 0, 0]], bras: [[0.32, 0.36], [0.32, 0.36]],
                      buste: -0.52, tete: -0.28 });
      const yeuxClos = p({ jambes: [[0, 0, 0], [0, 0, 0]], bras: [[0.02, 0.05], [0.02, 0.05]], tete: -0.20 });
      const cles: Cle[] = [
        { t: 3.6, p: joints }, { t: 4.1, p: joints }, { t: 4.7, p: rei }, { t: 5.5, p: rei },
        { t: 6.1, p: joints }, { t: 6.5, p: yeuxClos }, { t: 7.0, p: yeuxClos },
        { t: 7.3, p: p({ jambes: [[0, 0, 0], [0, 0, 0]], tete: 0.08 }) },
      ];
      poser(r, entre(cles, t), t < 3.4 ? 0 : doux((t - 3.4) / 0.3), wm);
    },
  },

  // DAMION CLARKE « TALLAWAH » — Kingston. Il arrive en rebondissant, puis
  // avance en pas de dancehall : les genoux qui plient sur le temps, les
  // epaules qui roulent, les bras qui balancent devant lui. Deux tapes sur la
  // poitrine, et il montre la ligne.
  dancehall: {
    duree: 6.8, bulle: [4.4, 6.6],
    jouer(r, t, dt) {
      let wm = 0;
      if (t < 2.4) wm = marcher(r, t, dt, 0, 2.4, -6.2, -2.0);
      else {
        const u = doux((t - 2.4) / 2.0);
        r.d = mel(-2.0, 0, u);
        r.demi = mel(ecartDuChemin(-6.2, -2.0), 0, u);
        r.cap = 0;
      }
      const pas = (s: number): Posture => {
        const w = s * Math.PI * 2 * 2.0;
        const rebond = Math.abs(Math.sin(w));
        const tape = Math.max(0, Math.sin(w / 2));
        return p({
          jambes: [[0.20 + 0.18 * rebond + 0.15 * tape, -0.20 - 0.10 * rebond, 0.05],
                   [0.15 + 0.18 * rebond, -0.25 - 0.10 * rebond - 0.15 * (1 - tape), 0.05]],
          bras: [[0.45 * Math.sin(w), 0.45 * Math.sin(w) + 1.50], [-0.45 * Math.sin(w), -0.45 * Math.sin(w) + 1.50]],
          roule: [0.15, 0.35], buste: -0.10 + 0.06 * Math.sin(w), leve: -0.06 - 0.04 * rebond,
          tete: 0.12 + 0.05 * Math.sin(w),
        });
      };
      const poitrine = (s: number): Posture => p({
        brasD: [0.50, 2.20 + 0.20 * Math.abs(Math.sin((s - 4.6) * Math.PI * 2 * 2.2))], roule: [0.25, 0.95], tete: 0.10,
      });
      const cles: Cle[] = [
        { t: 2.4, p: pas }, { t: 4.4, p: pas }, { t: 4.7, p: poitrine }, { t: 5.5, p: poitrine },
        { t: 5.9, p: POINTE }, { t: 6.4, p: POINTE }, { t: 6.8, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 2.2 ? 0 : doux((t - 2.2) / 0.3), wm);
    },
  },

  // KEREM AYDIN « ZEYBEK » — Izmir. La danse de la mer Egee : les bras
  // ouverts comme un aigle, un pas lent, une claque sur la cuisse, un genou a
  // terre — puis il se releve, et montre la ligne.
  zeybek: {
    duree: 7.4, bulle: [5.1, 7.2],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 2.8, -6.2, 0);
      const aigle = p({ bras: [[1.55, 1.90], [1.55, 1.90]], roule: [-0.95, -0.35], tete: 0.15, buste: 0.04 });
      const leve = p({ jambes: [[0.60, 0.10, 0], [-0.04, -0.04, 0]], bras: [[1.55, 1.90], [1.55, 1.90]],
                       roule: [-0.95, -0.35], tete: 0.18, buste: 0.06 });
      const claque = p({ brasG: [1.55, 1.90], brasD: [0.25, 0.35], roule: [-0.60, -0.20], tete: 0.05 });
      const genou = p({ jambes: [[1.45, 0.0, 0], [-0.05, -1.55, 0.10]], bras: [[1.55, 1.90], [1.55, 1.90]],
                        roule: [-0.95, -0.35], buste: 0.05, leve: -0.42, tete: 0.20 });
      const cles: Cle[] = [
        { t: 2.8, p: DEBOUT }, { t: 3.2, p: DEBOUT }, { t: 3.9, p: aigle }, { t: 4.3, p: leve },
        { t: 4.6, p: aigle }, { t: 4.75, p: claque }, { t: 5.0, p: aigle }, { t: 5.6, p: genou },
        { t: 6.1, p: genou }, { t: 6.6, p: aigle }, { t: 6.9, p: POINTE }, { t: 7.3, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 2.6 ? 0 : doux((t - 2.6) / 0.3), wm);
    },
  },

  // MARC PUIG « TRENCADIS » — Barcelone. Il arrive d'un bon pas et leve la main
  // ouverte tout la-haut : le geste de l'enxaneta, l'enfant qui grimpe au
  // sommet du castell et le couronne (« fer l'aleta »). Il la tient, l'agite
  // un peu, et la redescend.
  enxaneta: {
    duree: 6.2, bulle: [3.6, 6.0],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 2.8, -6.2, 0);
      const haut = (s: number): Posture => p({
        jambes: [[0.04, 0.04, -0.18], [-0.04, -0.04, -0.18]],
        brasD: [3.0, 3.08 + 0.12 * Math.sin(s * Math.PI * 2 * 1.6)], brasG: [0.05, 0.22],
        buste: 0.06, leve: 0.03, tete: 0.22,
      });
      const cles: Cle[] = [
        { t: 2.8, p: DEBOUT }, { t: 3.3, p: DEBOUT }, { t: 3.8, p: haut }, { t: 5.4, p: haut }, { t: 5.9, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 2.6 ? 0 : doux((t - 2.6) / 0.3), wm);
    },
  },

  // YASSINE BENALI « L'ATLAS » — Casablanca. Grand et calme : la main droite
  // sur le coeur, un signe de tete vers les tribunes, puis la main en visiere,
  // le regard au loin — l'homme des montagnes qui regarde le sommet, ici
  // l'arrivee.
  atlas: {
    duree: 7.2, bulle: [4.0, 6.8],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 3.4, -6.2, 0);
      const coeur = p({ brasD: [0.45, 2.25], roule: [0.25, 0.95], tete: 0.06 });
      const salut = p({ brasD: [0.45, 2.25], roule: [0.25, 0.95], tete: -0.24, buste: -0.08 });
      const visiere = p({ brasD: [1.95, 3.45], roule: [0.35, 0.60], tete: 0.14, buste: 0.04 });
      const cles: Cle[] = [
        { t: 3.4, p: DEBOUT }, { t: 3.8, p: DEBOUT }, { t: 4.3, p: coeur }, { t: 4.6, p: salut },
        { t: 4.9, p: coeur }, { t: 5.2, p: coeur }, { t: 5.6, p: visiere }, { t: 6.6, p: visiere },
        { t: 7.0, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 3.2 ? 0 : doux((t - 3.2) / 0.3), wm);
    },
  },

  // CHIDI OKAFOR « ZUMA » — Abuja. Il arrive en marchant, puis en dansant :
  // quelques pas de legwork, les jambes qui lancent tour a tour, les epaules
  // qui rebondissent. Il s'arrete, montre le ciel, puis la ligne.
  legwork: {
    duree: 6.4, bulle: [4.2, 6.4],
    jouer(r, t, dt) {
      // il marche jusqu'a -3 m, puis avance en dansant jusqu'a la ligne
      let wm = 0;
      if (t < 1.3) wm = marcher(r, t, dt, 0, 1.3, -6.2, -3.0);
      else {
        const u = doux((t - 1.3) / 2.3);
        r.d = mel(-3.0, 0, u);
        r.demi = mel(ecartDuChemin(-6.2, -3.0), 0, u);
        r.cap = 0;
      }
      const danse = (s: number): Posture => {
        const w = s * Math.PI * 2 * 2.2;
        const a = Math.max(0, Math.sin(w)), b = Math.max(0, Math.sin(w + Math.PI));
        return p({
          jambes: [[0.10 + 0.45 * a, 0.10 + 0.45 * a - 0.90 * a, -0.10 * a],
                   [0.10 + 0.45 * b, 0.10 + 0.45 * b - 0.90 * b, -0.10 * b]],
          bras: [[0.35 * Math.sin(w), 0.35 * Math.sin(w) + 1.40], [-0.35 * Math.sin(w), -0.35 * Math.sin(w) + 1.40]],
          roule: [0.10, 0.30], buste: -0.06 + 0.05 * Math.sin(2 * w),
          leve: -0.03 + 0.025 * Math.abs(Math.sin(w)), tete: 0.10,
        });
      };
      const ciel = p({ brasD: [2.9, 3.0], tete: 0.30, buste: 0.06 });
      const cles: Cle[] = [
        { t: 1.3, p: danse }, { t: 3.6, p: danse }, { t: 4.0, p: DEBOUT }, { t: 4.4, p: ciel },
        { t: 5.0, p: ciel }, { t: 5.4, p: POINTE }, { t: 5.9, p: POINTE }, { t: 6.3, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 1.1 ? 0 : doux((t - 1.1) / 0.3), wm);
    },
  },

  // THEO GARNIER « LE DANDY » — Paris. Il flane jusqu'a la ligne, ajuste son
  // foulard des deux mains, leve un pied derriere lui pour verifier le reflet
  // de sa pointe, et hoche la tete, satisfait.
  dandy: {
    duree: 7.8, bulle: [5.6, 7.6],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 3.6, -6.2, 0);
      const foulard = (s: number): Posture => p({
        bras: [[0.85, 2.65 + 0.08 * Math.sin(s * 18)], [0.85, 2.65 - 0.08 * Math.sin(s * 18)]],
        roule: [0.30, 1.00], tete: 0.12,
      });
      const semelle = p({ jambes: [[0.03, 0.03, 0], [-0.12, -1.75, -0.40]], brasD: [0.50, 0.70], brasG: [0.15, 0.35],
                          buste: 0.05, tete: -0.38 });
      const fier = p({ tete: 0.14, buste: 0.05 });
      const cles: Cle[] = [
        { t: 3.6, p: DEBOUT }, { t: 4.0, p: DEBOUT }, { t: 4.4, p: foulard }, { t: 5.2, p: foulard },
        { t: 5.7, p: semelle }, { t: 6.7, p: semelle }, { t: 7.0, p: p({ tete: -0.10 }) }, { t: 7.3, p: fier },
        { t: 7.7, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 3.4 ? 0 : doux((t - 3.4) / 0.3), wm);
    },
  },

  // JAYDEN BROOKS « EMPIRE » — New York. Il arrive en patron, puis prend la
  // pose de la statue de la Liberte : le bras droit tendu au ciel, comme la
  // torche, l'autre serrant la tablette contre lui. Il la tient, puis montre
  // l'arrivee.
  liberte: {
    duree: 6.6, bulle: [3.7, 6.0],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 2.8, -6.2, 0);
      const statue = p({ brasD: [2.85, 3.05], brasG: [0.55, 2.00], roule: [0.15, 0.85], tete: 0.18, buste: 0.05,
                         jambes: [[0.10, 0.06, 0], [-0.10, -0.06, 0]] });
      const cles: Cle[] = [
        { t: 2.8, p: DEBOUT }, { t: 3.2, p: DEBOUT }, { t: 3.7, p: statue }, { t: 5.3, p: statue },
        { t: 5.7, p: POINTE }, { t: 6.1, p: POINTE }, { t: 6.5, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 2.6 ? 0 : doux((t - 2.6) / 0.3), wm);
    },
  },

  // OLIVER HART « BIG BEN » — Londres. Un pas mesure jusqu'a la ligne ; il tire
  // sa montre a gousset, la regarde, la referme d'un coup sec, puis salue d'un
  // chapeau qu'il n'a pas.
  montre: {
    duree: 7.0, bulle: [5.3, 7.0],
    jouer(r, t, dt) {
      const wm = marcher(r, t, dt, 0, 3.4, -6.2, 0);
      const lit = p({ brasD: [0.55, 1.55], roule: [0.15, 0.55], tete: -0.32 });
      const ferme = p({ brasD: [0.30, 0.60], roule: [0.05, 0.20], tete: 0.02 });
      const chapeau = p({ brasD: [1.85, 3.35], roule: [0.30, 0.50], tete: -0.12 });
      const salue = p({ brasD: [1.70, 2.40], roule: [0.20, 0.30], tete: 0.06 });
      const cles: Cle[] = [
        { t: 3.4, p: DEBOUT }, { t: 3.7, p: DEBOUT }, { t: 4.2, p: lit }, { t: 5.15, p: lit },
        // le coup sec : quinze centiemes
        { t: 5.30, p: ferme }, { t: 5.6, p: ferme }, { t: 6.0, p: chapeau }, { t: 6.3, p: salue },
        { t: 6.8, p: DEBOUT },
      ];
      poser(r, entre(cles, t), t < 3.2 ? 0 : doux((t - 3.2) / 0.3), wm);
    },
  },

  // HERMES « LE MESSAGER » — la ligne de Karman. Il ne marche pas jusqu'a la
  // ligne : il y descend du ciel, les bras ouverts, la pointe des pieds
  // tendue, se pose en flechissant, se dresse, et rebondit d'un rien.
  descente: {
    duree: 4.8, bulle: [2.4, 4.6], plan: 1.5, visee: -0.6,
    jouer(r, t) {
      r.d = 0; r.demi = 0; r.cap = 0;
      const vol = (s: number): Posture => p({
        jambes: [[0.05, 0.05, -0.45], [-0.05, -0.05, -0.45]],
        bras: [[2.3, 2.5], [2.3, 2.5]], roule: [-0.55, -0.20], buste: 0.04, tete: 0.10,
        leve: 3.2 * (1 - doux(s / 1.8)),
      });
      const pose = p({ jambes: [[0.35, -0.30, 0], [0.30, -0.35, 0]], bras: [[1.2, 1.4], [1.2, 1.4]],
                       roule: [-0.40, 0], leve: -0.06, tete: 0.0 });
      const dresse = p({ jambes: [[0.04, 0.04, -0.20], [-0.04, -0.04, -0.20]], bras: [[0.6, 0.7], [0.6, 0.7]],
                         roule: [-0.40, 0], leve: 0.02, tete: 0.16 });
      const rebond = (s: number): Posture => ({ ...dresse, leve: 0.02 + 0.12 * Math.sin(Math.PI * doux((s - 2.8) / 0.8)) });
      const cles: Cle[] = [
        { t: 0, p: vol }, { t: 1.8, p: vol }, { t: 2.15, p: pose }, { t: 2.7, p: dresse },
        { t: 2.8, p: rebond }, { t: 3.6, p: rebond }, { t: 4.4, p: DEBOUT },
      ];
      poser(r, entre(cles, t), 1);
    },
  },

  // SUN WUKONG « LE ROI SINGE » — l'Olympe. Il tombe du ciel accroupi, comme
  // sur son nuage, se pose, tourne une fois sur lui-meme, et prend la pose du
  // Roi Singe : la main en visiere au-dessus des yeux, un genou leve.
  nuage: {
    duree: 5.6, bulle: [2.6, 5.4], plan: 1.6, visee: -0.6,
    jouer(r, t) {
      r.d = 0; r.demi = 0;
      // un tour complet entre 1,4 et 2,1 s
      r.cap = t < 1.4 ? 0 : t < 2.1 ? -2 * Math.PI * doux((t - 1.4) / 0.7) : 0;
      const vol = (s: number): Posture => p({
        jambes: [[0.95, -0.35, 0.1], [0.85, -0.45, 0.1]], bras: [[1.0, 1.8], [1.0, 1.8]],
        roule: [-0.4, 0], buste: -0.20, tete: 0.15, leve: 2.6 * (1 - doux(s / 1.2)) - 0.18,
      });
      const pose = p({ jambes: [[0.10, 0.05, -0.15], [1.10, -0.20, 0.10]], brasD: [1.95, 3.45], brasG: [0.40, 1.20],
                       roule: [0.35, 0.60], buste: -0.06, tete: 0.18, leve: 0.02 });
      const cles: Cle[] = [
        { t: 0, p: vol }, { t: 1.2, p: vol }, { t: 1.45, p: p({ jambes: [[0.5, -0.4, 0], [0.45, -0.45, 0]], leve: -0.12 }) },
        { t: 2.1, p: DEBOUT }, { t: 2.5, p: pose }, { t: 4.8, p: pose }, { t: 5.4, p: DEBOUT },
      ];
      poser(r, entre(cles, t), 1);
    },
  },

  // ANANSI « L'ARAIGNEE » — l'Olympe. Il descend du ciel au bout de son fil,
  // les deux mains serrees au-dessus de la tete, se pose sans un bruit, agite
  // l'index — on ne l'y prendra pas —, et salue, la main sur le coeur.
  fil: {
    duree: 6.6, bulle: [3.4, 6.4], plan: 1.5, visee: -0.6,
    jouer(r, t) {
      r.d = 0; r.demi = 0; r.cap = 0;
      const fil = (s: number): Posture => p({
        jambes: [[0.02, 0.02, -0.40], [-0.02, -0.02, -0.40]], bras: [[3.0, 3.1], [3.0, 3.1]],
        roule: [0.25, 0.10], tete: 0.05, leve: 3.4 * (1 - doux(s / 2.6)),
      });
      const index = (s: number): Posture => p({
        brasD: [0.60, 2.55 + 0.18 * Math.sin((s - 3.0) * Math.PI * 2 * 3.0)], roule: [0.10, 0.20], tete: 0.10,
      });
      const salut = p({ brasD: [0.45, 2.25], roule: [0.25, 0.95], buste: -0.18, tete: -0.20 });
      const cles: Cle[] = [
        { t: 0, p: fil }, { t: 2.6, p: fil }, { t: 3.0, p: DEBOUT }, { t: 3.3, p: index }, { t: 4.5, p: index },
        { t: 4.9, p: salut }, { t: 5.8, p: salut }, { t: 6.4, p: DEBOUT },
      ];
      poser(r, entre(cles, t), 1);
    },
  },

  // INTI « LE SOLEIL » — l'Olympe. A genoux a la ligne quand la camera
  // arrive, la tete baissee ; il se leve lentement en ouvrant les deux bras au
  // ciel, paumes ouvertes, la tete renversee — le soleil qui se leve.
  soleil: {
    duree: 6.0, bulle: [3.2, 5.8], plan: 1.7,
    jouer(r, t) {
      r.d = 0; r.demi = 0; r.cap = 0;
      const genou = p({ jambes: [[1.45, 0.0, 0], [-0.05, -1.55, 0.10]], bras: [[0.10, 0.30], [0.10, 0.30]],
                        buste: -0.30, leve: -0.42, tete: -0.40 });
      const leve = p({ bras: [[2.55, 2.85], [2.55, 2.85]], roule: [-0.55, -0.25], buste: 0.10, tete: 0.32,
                       jambes: [[0.06, 0.04, -0.10], [-0.06, -0.04, -0.10]], leve: 0.02 });
      const cles: Cle[] = [
        { t: 0, p: genou }, { t: 1.0, p: genou }, { t: 2.8, p: leve }, { t: 5.2, p: leve }, { t: 5.9, p: DEBOUT },
      ];
      poser(r, entre(cles, t), 1);
    },
  },

  // ZENITH « L'ASTRE » — l'apotheose. Il descend de tres haut, lentement, et
  // s'ouvre en V quand il touche la piste, les bras au ciel.
  astre: {
    duree: 5.4, bulle: [3.2, 5.2], plan: 1.35, visee: -0.4,
    jouer(r, t) {
      r.d = 0; r.demi = 0; r.cap = 0;
      const chute = (s: number): Posture => p({
        jambes: [[0.02, 0.02, -0.40], [-0.02, -0.02, -0.40]],
        bras: [[0.30, 0.40], [0.30, 0.40]], roule: [-0.30, 0], tete: -0.10,
        leve: 5.0 * (1 - doux(s / 3.0)),
      });
      const v = p({ jambes: [[0.12, 0.08, -0.15], [-0.12, -0.08, -0.15]], bras: [[2.6, 2.9], [2.6, 2.9]],
                    roule: [-0.50, -0.20], tete: 0.28, buste: 0.08, leve: 0.03 });
      const cles: Cle[] = [
        { t: 0, p: chute }, { t: 3.0, p: chute }, { t: 3.5, p: v }, { t: 4.6, p: v }, { t: 5.2, p: DEBOUT },
      ];
      poser(r, entre(cles, t), 1);
    },
  },
};

/** Les choregraphies qui existent, pour le harnais. */
export const ENTREES = Object.keys(CHOREGRAPHIES);

/** Sa duree, pour le harnais et pour l'affiche. */
export function dureeDeLEntree(cle: string): number {
  return CHOREGRAPHIES[cle] ? CHOREGRAPHIES[cle].duree : 0;
}

/* ---------------------------------------------------------------------------
   CE QU'IL DIT
   --------------------------------------------------------------------------- */

/** Sa replique dans la bulle : dans sa langue (la traduction est dans le bandeau). */
function texteDeLaBulle(l: Lieu): string {
  const N = (globalThis as any).SprinterI18N;
  const en = N && N.index ? N.index() === 1 : false;
  return l.replique.vo || (en ? l.replique.en : l.replique.fr);
}

/**
 * L'entree d'un boss, telle que engine.ts la joue (`avantDepart.entree`) :
 * `jouer` est appele a chaque image tant que `avD.reste` reste positif.
 */
export function entreeDe(l: Lieu): any {
  const ch = CHOREGRAPHIES[l.entree];
  if (!ch) return { depuis: -6.2, coureur: l.boss };       // l'entree d'Aurel, a defaut
  const E: any = { coureur: l.boss, plan: ch.plan, visee: ch.visee, cle: l.entree };
  let bullePosee = false;
  E.jouer = (r: any, avD: any, dt: number) => {
    const t = avD.t || 0;
    ch.jouer(r, t, dt);
    r.v = 0;
    // SA BULLE, le temps de sa replique : le moteur la dessine au-dessus de
    // celui qu'on presente (drawBulle, sprinter-app.js), et la retire au coup
    // de pistolet (finirLesSaluts).
    const G = SprinterApp.G;
    const parle = t >= ch.bulle[0] && t < ch.bulle[1];
    if (parle && !bullePosee) { G.presente = r; G.presBulle = texteDeLaBulle(l); bullePosee = true; }
    // La bulle s'ouvre en fondu sur `presDepuis`, que seule la presentation du
    // championnat fait avancer (pousserLePlan) : sans ceci, elle restait
    // posee mais transparente — vu sur le canevas le 06/10.
    if (parle) G.presDepuis = t - ch.bulle[0];
    if (!parle && bullePosee && G.presente === r) { G.presente = null; G.presBulle = null; bullePosee = false; }
    avD.reste = 99;
    if (t >= ch.duree) {
      // IL REND LA MAIN : debout a la ligne, au repos, dans l'axe de son couloir ;
      // le decompte part et il s'installe dans ses blocs avec les autres.
      r.posture = null; r.marche = 0; r.pointe = 0;
      r.d = 0; r.demi = 0; r.cap = 0;
      if (G.presente === r) { G.presente = null; G.presBulle = null; }
      avD.reste = 0;
    }
  };
  return E;
}
