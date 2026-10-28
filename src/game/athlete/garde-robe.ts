// LA GARDE-ROBE — des tenues pour chaque moment de la vie d'un athlete.
//
// L'auteur, 25/10 : « en ville tout le monde porte la tenue d'athlete ? non,
// augmente les tenues possibles ». D'apres Lagos Life (une tenue « Everyday »,
// « Home », « Sleep » qui change toute seule) : ici une tenue par MOMENT — la
// ville, l'entrainement, la competition, la nuit.
//
// Une tenue ne fabrique pas de maillage : elle dit quelles ZONES du corps
// (tools/blender/corps_ville.py) prennent la couleur du haut, du bas ou restent
// nues. Un t-shirt peint les manches, un jean les cuisses et les mollets, une robe
// descend jusqu'au genou. Leger pour le plus petit telephone, et autant de
// tenues qu'on veut.

export type Texte = [string, string];
export type Moment = 'ville' | 'entrainement' | 'competition' | 'nuit';
export type Zone = 'maillot' | 'ventre' | 'manches' | 'avantbras' | 'short' | 'cuisses' | 'mollets';
type Rgb = [number, number, number];
/** Ce que porte chaque zone : le haut, le bas, ou la peau (absente). */
type Couvre = Partial<Record<Zone, 'haut' | 'bas'>>;

export type Tenue = {
  id: string; nom: Texte; moment: Moment;
  couvre: Couvre;
  haut: Rgb; bas: Rgb; chaussures: Rgb;
  /** Le prix a la boutique ; 0 : on l'a des le depart. */
  prix: number;
  /** Reservee a un corps (une brassiere, une robe) ; absente : pour tous. */
  pour?: 'f' | 'm';
};

const HAUT_COURT: Couvre = { maillot: 'haut', ventre: 'haut', manches: 'haut' };
const HAUT_LONG: Couvre = { ...HAUT_COURT, avantbras: 'haut' };
const BAS_LONG: Couvre = { short: 'bas', cuisses: 'bas', mollets: 'bas' };

export const TENUES: Tenue[] = [
  // la ville
  { id: 'tshirt-jean', nom: ['T-shirt et jean', 'T-shirt & jeans'], moment: 'ville', couvre: { ...HAUT_COURT, ...BAS_LONG }, haut: [240, 240, 236], bas: [52, 82, 140], chaussures: [245, 245, 245], prix: 0 },
  { id: 'sweat-jogging', nom: ['Sweat et jogging', 'Hoodie & joggers'], moment: 'ville', couvre: { ...HAUT_LONG, ...BAS_LONG }, haut: [70, 74, 84], bas: [40, 42, 50], chaussures: [230, 230, 230], prix: 0 },
  { id: 'chemise-chino', nom: ['Chemise et chino', 'Shirt & chinos'], moment: 'ville', couvre: { ...HAUT_LONG, ...BAS_LONG }, haut: [170, 200, 230], bas: [196, 170, 128], chaussures: [90, 60, 40], prix: 35 },
  { id: 'polo-bermuda', nom: ['Polo et bermuda', 'Polo & shorts'], moment: 'ville', couvre: { ...HAUT_COURT, short: 'bas', cuisses: 'bas' }, haut: [30, 120, 90], bas: [210, 200, 170], chaussures: [250, 250, 250], prix: 25 },
  { id: 'veste-jean', nom: ['Veste et jean noir', 'Jacket & black jeans'], moment: 'ville', couvre: { ...HAUT_LONG, ...BAS_LONG }, haut: [120, 60, 40], bas: [28, 28, 32], chaussures: [20, 20, 22], prix: 60 },
  { id: 'crop-jean', nom: ['Crop top et jean', 'Crop top & jeans'], moment: 'ville', couvre: { maillot: 'haut', manches: 'haut', ...BAS_LONG }, haut: [236, 72, 96], bas: [70, 100, 160], chaussures: [250, 250, 250], prix: 20, pour: 'f' },
  { id: 'robe-ete', nom: ['Robe d’été', 'Summer dress'], moment: 'ville', couvre: { maillot: 'haut', ventre: 'haut', short: 'haut', cuisses: 'haut' }, haut: [248, 205, 74], bas: [248, 205, 74], chaussures: [200, 150, 110], prix: 30, pour: 'f' },
  { id: 'jupe-top', nom: ['Jupe et top', 'Skirt & top'], moment: 'ville', couvre: { ...HAUT_COURT, short: 'bas', cuisses: 'bas' }, haut: [250, 250, 250], bas: [40, 40, 60], chaussures: [30, 30, 30], prix: 30, pour: 'f' },
  { id: 'wax', nom: ['Tenue en wax', 'Wax print outfit'], moment: 'ville', couvre: { ...HAUT_LONG, ...BAS_LONG }, haut: [230, 120, 30], bas: [40, 90, 160], chaussures: [120, 80, 50], prix: 45 },
  // l'entrainement
  { id: 'debardeur-short', nom: ['Débardeur et short', 'Singlet & shorts'], moment: 'entrainement', couvre: { maillot: 'haut', ventre: 'haut', short: 'bas' }, haut: [61, 220, 132], bas: [30, 32, 48], chaussures: [245, 245, 245], prix: 0 },
  { id: 'tshirt-cuissard', nom: ['T-shirt technique et cuissard', 'Tech tee & tights'], moment: 'entrainement', couvre: { ...HAUT_COURT, short: 'bas', cuisses: 'bas' }, haut: [80, 140, 230], bas: [24, 24, 30], chaussures: [250, 120, 40], prix: 30 },
  { id: 'brassiere-cuissard', nom: ['Brassière et cuissard', 'Sports bra & tights'], moment: 'entrainement', couvre: { maillot: 'haut', short: 'bas', cuisses: 'bas' }, haut: [167, 139, 250], bas: [24, 24, 30], chaussures: [245, 245, 245], prix: 30, pour: 'f' },
  { id: 'survetement', nom: ['Survêtement', 'Tracksuit'], moment: 'entrainement', couvre: { ...HAUT_LONG, ...BAS_LONG }, haut: [30, 60, 140], bas: [30, 60, 140], chaussures: [245, 245, 245], prix: 55 },
  // la competition : le maillot du club, aux couleurs de l'athlete
  { id: 'competition', nom: ['Maillot de compétition', 'Racing kit'], moment: 'competition', couvre: { maillot: 'haut', ventre: 'haut', short: 'bas' }, haut: [61, 220, 132], bas: [20, 22, 34], chaussures: [250, 250, 250], prix: 0 },
  // la nuit
  { id: 'pyjama', nom: ['Pyjama', 'Pyjamas'], moment: 'nuit', couvre: { ...HAUT_LONG, ...BAS_LONG }, haut: [150, 170, 210], bas: [150, 170, 210], chaussures: [200, 200, 210], prix: 0 },
  { id: 'nuit-short', nom: ['T-shirt et short', 'Tee & shorts'], moment: 'nuit', couvre: { ...HAUT_COURT, short: 'bas' }, haut: [230, 230, 230], bas: [60, 60, 80], chaussures: [200, 200, 210], prix: 10 },
];
const PAR_ID = new Map(TENUES.map(t => [t.id, t]));
export const tenue = (id: string | undefined) => (id && PAR_ID.get(id)) || null;
export const tenuesDu = (m: Moment, corps: 'f' | 'm') => TENUES.filter(t => t.moment === m && (!t.pour || t.pour === corps));

/** La garde-robe d'un athlete : ce qu'il possede, et ce qu'il porte a chaque moment. */
export type GardeRobe = { possede: string[]; porte: Record<Moment, string> };
export const GARDE_ROBE_DE_DEPART: GardeRobe = {
  possede: TENUES.filter(t => t.prix === 0).map(t => t.id),
  porte: { ville: 'tshirt-jean', entrainement: 'debardeur-short', competition: 'competition', nuit: 'pyjama' },
};

/** Les couleurs a poser sur chaque zone du corps 3D (ville.ts, teindre). */
export function couleursDe(t: Tenue, peau: Rgb, maillot?: Rgb): Record<Zone, Rgb> & { pointes: Rgb } {
  const haut = t.moment === 'competition' && maillot ? maillot : t.haut;
  const z = (k: Zone) => (t.couvre[k] === 'haut' ? haut : t.couvre[k] === 'bas' ? t.bas : peau);
  return {
    maillot: z('maillot'), ventre: z('ventre'), manches: z('manches'), avantbras: z('avantbras'),
    short: z('short'), cuisses: z('cuisses'), mollets: z('mollets'), pointes: t.chaussures,
  };
}

/** Une tenue de ville tiree une fois pour toutes sur un nom (les passants, les gens du jeu). */
export function tenueDeVilleDe(nom: string, corps: 'f' | 'm'): Tenue {
  const l = tenuesDu('ville', corps);
  let h = 7; for (const c of nom) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return l[h % l.length];
}

/**
 * Le moment de la journee, pour la tenue : la nuit a la maison, la competition le jour J,
 * l'entrainement autour de la seance du jour, la ville le reste du temps.
 */
export function momentDe(heure: number, competition: boolean, seance: { debut: number; fin: number; faite: boolean } | null): Moment {
  if (heure >= 22 * 60 || heure < 7 * 60) return 'nuit';
  if (competition && heure < 18 * 60) return 'competition';
  if (seance && !seance.faite && heure >= seance.debut - 60 && heure <= seance.fin) return 'entrainement';
  return 'ville';
}
