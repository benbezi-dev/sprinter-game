import React from 'react';

/**
 * Le drapeau d'un pays, la medaille d'un athlete, et l'ecusson de sa division.
 *
 * Les deux vivent ici parce qu'ils apparaissent aux memes endroits — le
 * classement general, les grilles de championnat, les podiums — et qu'ils
 * doivent y avoir exactement la meme forme partout. Les recopier a chaque
 * ecran, c'est se garantir qu'un jour l'un d'eux sera different des autres.
 */

/**
 * Le drapeau, en emoji, a partir du code du pays.
 *
 * Un drapeau emoji n'est pas une image : c'est la paire de lettres du pays,
 * ecrite avec les « indicateurs regionaux » d'Unicode, que le systeme
 * remplace par le dessin. Aucun fichier a charger, aucune licence a verifier,
 * et deux cents pays couverts par deux lignes de calcul.
 *
 * Sur les rares systemes qui ne les dessinent pas — Windows, essentiellement —
 * les deux lettres restent lisibles a la place. C'est degrade, pas casse.
 */
export function drapeauDe(code?: string | null): string {
  const c = String(code || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return String.fromCodePoint(
    0x1F1E6 + c.charCodeAt(0) - 65,
    0x1F1E6 + c.charCodeAt(1) - 65,
  );
}

export function Drapeau({ pays, className = '' }: { pays?: string | null; className?: string }) {
  const d = drapeauDe(pays);
  if (!d) return null;
  return (
    <span className={`shrink-0 leading-none ${className}`}
          title={String(pays).toUpperCase()} aria-label={String(pays).toUpperCase()}>
      {d}
    </span>
  );
}

export type MedailleInfo = {
  echelon: 'national' | 'continental' | 'mondial';
  zone: string;
  zoneNom: string;
  place: number;
};

/**
 * Or, argent, bronze.
 *
 * Exportees pour la meme raison que le reste de ce fichier existe : le tableau
 * des medailles par nation peint les memes trois couleurs, et les y recopier
 * serait se garantir qu'un jour l'or d'un ecran ne sera plus celui de l'autre.
 */
export const COULEURS_MEDAILLE = ['#F8CD4A', '#CBD5E1', '#C1803F'];
const COULEURS = COULEURS_MEDAILLE;

/**
 * Le sigle de la competition, pas son nom complet.
 *
 * Le mondial n'a pas de zone a nommer ; les deux autres portent la leur, mais
 * abregee : une ligne de classement n'a pas la place d'ecrire « Championnat
 * national de France » a cote d'un pseudo.
 */
function sigle(m: MedailleInfo): string {
  if (m.echelon === 'mondial') return 'MONDE';
  return m.zoneNom.slice(0, 3).toUpperCase();
}

export function Medaille({ m, taille = 'petit' }: {
  m?: MedailleInfo | null; taille?: 'petit' | 'grand';
}) {
  if (!m || m.place < 1 || m.place > 3) return null;
  const c = COULEURS[m.place - 1];
  const petit = taille === 'petit';
  return (
    <span
      className={`shrink-0 inline-flex items-center gap-1 rounded-full border font-bold
                  tracking-widest ${petit ? 'px-1.5 py-[1px] text-[8px]' : 'px-2 py-0.5 text-[10px]'}`}
      style={{ color: c, borderColor: c + '55', backgroundColor: c + '18' }}
      title={`${m.place}${m.place === 1 ? 'er' : 'e'} — ${m.zoneNom}`}
    >
      {/* Le disque dit la couleur, le sigle dit la competition. Ensemble ils
          tiennent dans la largeur d'un pseudo. */}
      <span className={petit ? 'w-1.5 h-1.5 rounded-full' : 'w-2 h-2 rounded-full'}
            style={{ backgroundColor: c }} />
      {sigle(m)}
    </span>
  );
}


/* ------------------------------------------------------------- l'ecusson */

import { SprinterApp } from '@/game/engine';
import { Flame as IconeFlamme } from 'lucide-react';
import { nomDiscipline, type Etage } from '@/game/duels';

/**
 * La couleur d'un etage.
 *
 * Elle monte du terreux au dore, et le sommet est le seul a briller. Jamais la
 * couleur seule, cependant : l'ecusson porte toujours le nom de l'etage et,
 * sauf en Legende, le chiffre romain de la division. Quelqu'un qui ne
 * distingue pas l'ambre du bronze doit pouvoir lire son rang.
 */
const TEINTES: Record<Etage, string> = {
  departemental: 'text-amber-700/90 border-amber-700/40 bg-amber-700/10',
  regional:      'text-slate-300 border-slate-300/40 bg-slate-300/10',
  national:      'text-primary border-primary/40 bg-primary/10',
  elite:         'text-cyan-300 border-cyan-400/40 bg-cyan-400/10',
  legende:       'text-fuchsia-300 border-fuchsia-400/50 bg-fuchsia-400/12',
};

/** La teinte d'un etage, pour qui dessine son propre ecusson (la fiche de la
 *  presentation, en plus grand) sans en inventer une autre. */
export function teinteDuRang(etage: Etage): string {
  return TEINTES[etage] || TEINTES.departemental;
}

const ROMAINS = ['', 'I', 'II', 'III', 'IV'];

/** Le rang lisible : « NATIONAL II », ou « LÉGENDE ». */
export function nomDuRang(etage: Etage, division: number): string {
  const { N } = SprinterApp;
  const nom = N.t('rang_' + etage);
  return division > 0 ? `${nom} ${ROMAINS[division] || ''}`.trim() : nom;
}

/**
 * La forme courte, pour les lignes d'un classement.
 *
 * « DÉPARTEMENTAL IV » plus un nombre de points ne tient pas sur la largeur
 * d'un telephone a cote d'un pseudo : c'est le pseudo qui se faisait couper,
 * et c'est lui qu'on vient lire. Le nom entier reste dans l'etiquette lue par
 * les lecteurs d'ecran — abreger a l'oeil ne doit pas abreger a l'oreille.
 */
function abrege(etage: Etage, division: number): string {
  const { N } = SprinterApp;
  const court = N.t('rang_court_' + etage);
  return division > 0 ? `${court}${ROMAINS[division] || ''}` : court;
}

/**
 * `epreuve` nomme la DISCIPLINE de ce rang, et l'ecusson ne devrait presque
 * jamais s'en passer.
 *
 * Les niveaux ne sont pas partagés : « NATIONAL II » tout seul ne dit pas sur
 * quoi. Dans une liste on l'omet — l'écran entier porte déjà la distance en
 * titre, et la répéter sur trois cents lignes ne dirait rien de plus — mais
 * partout où l'écusson voyage seul, sur l'accueil notamment, il la porte.
 */
export function Ecusson({ etage, division, lp, epreuve, compact = false, className = '' }: {
  etage: Etage; division: number; lp?: number; epreuve?: string | null;
  compact?: boolean; className?: string;
}) {
  if (!etage) return null;
  const teinte = TEINTES[etage] || TEINTES.departemental;
  const complet = nomDuRang(etage, division);
  const distance = epreuve ? nomDiscipline(epreuve) : '';
  const lu = distance ? `${distance}, ${complet}` : complet;
  return (
    <span className={`shrink-0 inline-flex items-baseline gap-1 px-1.5 py-0.5 rounded-md
                      border font-mono text-[9px] tracking-widest ${teinte} ${className}`}
          title={distance ? `${complet} — ${distance}` : complet}
          aria-label={lp != null ? `${lu}, ${lp}` : lu}>
      {distance && <span className="opacity-70" aria-hidden>{distance}</span>}
      <span className="font-bold" aria-hidden>
        {compact ? abrege(etage, division) : complet}
      </span>
      {lp != null && <span className="tabular-nums opacity-80" aria-hidden>{lp}</span>}
    </span>
  );
}


/* -------------------------------------------------------------- la flamme */

/**
 * La serie de victoires, quand elle devient remarquable.
 *
 * Elle ne compte pas les duels joues mais ceux gagnes SANS EN PERDRE UN : une
 * seule defaite la ramene a zero. C'est ce qui la distingue de tout le reste
 * de l'ecran — le palier, les points, le bilan sont des acquis, elle est la
 * seule chose qu'on peut perdre en entier d'un coup.
 *
 * POURQUOI UN DESSIN ET PAS UN EMOJI. La flamme doit changer de couleur, et un
 * emoji ne le permet pas : le systeme le dessine lui-meme, toujours de la meme
 * couleur, et aucun style ne l'atteint. C'est l'inverse du drapeau plus haut,
 * ou l'on veut justement que le systeme dessine.
 */

/**
 * A partir de combien la flamme s'allume.
 *
 * Cinq, parce qu'en dessous ce n'est pas une serie, c'est une bonne journee.
 */
export const SERIE_MIN = 5;

/**
 * Les couleurs suivent la temperature d'une vraie flamme : rouge, orange,
 * jaune, blanc-bleu, violet. C'est la seule progression que l'oeil lit comme
 * « de plus en plus chaud » sans qu'on ait a l'expliquer — et le sommet tombe
 * sur le violet de LEGENDE, deja porte par l'ecusson le plus haut.
 *
 * Les seuils sont ici et nulle part ailleurs : les deplacer est une ligne.
 * Ils sont serres a dessein — sur un classement de trente joueurs, un palier
 * qu'on atteint une fois par an n'existe pas.
 */
const SERIES = [
  { seuil: 5,  corps: '#DC2626', coeur: '#FCA5A5', halo: 0.30 },
  { seuil: 8,  corps: '#F97316', coeur: '#FDBA74', halo: 0.40 },
  { seuil: 12, corps: '#F8CD4A', coeur: '#FEF3C7', halo: 0.55 },
  { seuil: 18, corps: '#67E8F9', coeur: '#F0FDFF', halo: 0.70 },
  { seuil: 25, corps: '#E879F9', coeur: '#FDF4FF', halo: 0.85 },
];

/** Le palier d'une serie, ou rien si elle n'a pas encore allume la flamme. */
export function palierDeSerie(serie?: number | null) {
  const n = Number(serie) || 0;
  if (n < SERIE_MIN) return null;
  let p = SERIES[0];
  for (const s of SERIES) if (n >= s.seuil) p = s;
  return p;
}

/**
 * Le dessin seul : le corps de la flamme, et son coeur plus clair.
 *
 * Deux flammes l'une dans l'autre. Une seule couleur pleine faisait une
 * goutte — c'est le coeur qui donne la lecture « ca brule » a douze pixels.
 *
 * `eteinte` la passe en gris sans halo : c'est la meme forme, et c'est
 * justement ce qu'il faut. Une flamme eteinte doit se reconnaitre comme la
 * flamme qu'on vient de perdre, pas comme un autre symbole.
 */
function Dessin({ px, p, ombre = 0, eteinte = false }: {
  px: number; p: { corps: string; coeur: string; halo: number };
  ombre?: number; eteinte?: boolean;
}) {
  const halo = Math.round(p.halo * 255).toString(16).padStart(2, '0');
  return (
    <span className="relative inline-block shrink-0"
          style={{ width: px, height: px }} aria-hidden>
      <IconeFlamme size={px} fill={p.corps} stroke={p.corps} strokeWidth={1.6}
                   style={eteinte ? { opacity: 0.65 }
                        : { filter: `drop-shadow(0 0 ${ombre}px ${p.corps}${halo})` }} />
      <IconeFlamme size={px * 0.52} fill={p.coeur} stroke={p.coeur} strokeWidth={2}
                   className="absolute"
                   style={{ left: px * 0.24, top: px * 0.40, opacity: eteinte ? 0.65 : 1 }} />
    </span>
  );
}

/** Le gris d'une flamme qui ne brule pas : celle qu'on approche, celle qui casse. */
const CENDRE = { corps: '#475569', coeur: '#64748B', halo: 0 };

/**
 * La serie en cours, a cote du nom : COMBO ×5.
 *
 * SOBRE PAR CONSTRUCTION. Ni cadre ni fond : la ligne du classement porte deja
 * un drapeau, un ecusson, une medaille, un bilan et une fleche de mouvement —
 * une forme de plus et plus rien ne se detache. Ce qui rend le combo visible
 * n'est pas un encadre, c'est sa couleur : elle est la seule tache rouge,
 * orange ou violette d'une ligne par ailleurs jaune et grise.
 *
 * Le nombre ne s'ecrit plus seul. « 5 » a cote d'un dessin demandait de
 * deviner de quoi on parlait ; « COMBO ×5 » se lit sans legende, dans les deux
 * langues, et dit au passage que le compteur monte.
 */
export function Flamme({ serie, taille = 'petit', className = '' }: {
  serie?: number | null; taille?: 'petit' | 'grand'; className?: string;
}) {
  const p = palierDeSerie(serie);
  if (!p) return null;
  const n = Number(serie);
  const { N } = SprinterApp;
  const petit = taille === 'petit';
  const px = petit ? 12 : 16;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 font-mono font-bold
                      tracking-widest tabular-nums whitespace-nowrap
                      ${petit ? 'text-[9px]' : 'text-[11px]'} ${className}`}
          style={{ color: p.corps }}
          title={N.t('serie_titre', { n })} aria-label={N.t('serie_titre', { n })}>
      <Dessin px={px} p={p} ombre={petit ? 3 : 5} />
      {N.t('serie_combo', { n })}
    </span>
  );
}

/**
 * A une ou deux victoires du seuil : la flamme en cendre, et ce qui reste.
 *
 * C'est le ressort entier de la chose. Un palier qu'on ne voit qu'une fois
 * atteint ne fait jouer personne ; celui qu'on voit approcher, si — et la
 * donnee est deja la, il n'y avait qu'a la dire.
 *
 * Elle ne se montre QUE sur sa propre ligne, et sur l'ecran de fin de duel.
 * Repetee sur les cinq cents lignes du classement, ce serait cinq cents
 * comptes a rebours qui ne regardent pas celui qui lit.
 */
export function Approche({ serie, className = '' }: {
  serie?: number | null; className?: string;
}) {
  const n = Number(serie) || 0;
  if (n < SERIE_MIN - 2 || n >= SERIE_MIN) return null;
  const reste = SERIE_MIN - n;
  const { N } = SprinterApp;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 font-mono font-bold
                      tracking-widest tabular-nums whitespace-nowrap text-[9px]
                      text-muted-foreground ${className}`}>
      <Dessin px={12} p={CENDRE} eteinte />
      ×{n} · {N.t('serie_approche', { n: reste })}
    </span>
  );
}

/**
 * La serie qui vient de casser : COMBO BREAK ×12.
 *
 * Le terme est celui des bornes de combat, et il dit exactement ce qui se
 * passe. En rouge, et c'est la seule fois ou la serie hausse le ton : elle
 * vient de couter douze victoires, ce n'est pas le moment de chuchoter.
 *
 * `serie` est ici celle d'AVANT le duel — le nombre qu'on avait, pas celui
 * qui reste (zero, et qui ne raconte rien).
 */
export function ComboBreak({ serie, className = '' }: {
  serie?: number | null; className?: string;
}) {
  const n = Number(serie) || 0;
  if (n < SERIE_MIN) return null;
  const { N } = SprinterApp;
  return (
    <span className={`shrink-0 inline-flex items-center gap-1.5 font-mono font-bold
                      tracking-widest tabular-nums whitespace-nowrap text-[10px]
                      text-destructive ${className}`}
          aria-label={N.t('serie_eteinte', { n })}>
      <Dessin px={13} p={CENDRE} eteinte />
      {N.t('serie_eteinte', { n })}
    </span>
  );
}

/**
 * LE SURSIS : « 2 J » a cote du combo, quand il va s'eteindre faute de jouer.
 *
 * Une serie s'eteint apres huit jours sans duel sur la distance — c'est la
 * regle du serveur, et lui seul la connait : il rend une DATE de fin, que
 * voici comparee a l'heure qu'il est. Rien a recopier, donc rien a faire
 * diverger.
 *
 * Pourquoi le dire. Une flamme qui disparait sans prevenir n'est pas une
 * regle, c'est une panne : le joueur l'a vue rouge hier, elle n'est plus la
 * ce matin, et rien a l'ecran ne lui apprendra jamais pourquoi. Prevenu trois
 * jours avant, il a le temps d'y faire quelque chose — et une flamme qui
 * expire ce week-end est une raison de revenir jouer.
 *
 * Trois jours, et pas plus : au-dela, le compte a rebours serait affiche en
 * permanence et ne voudrait plus rien dire. Le dernier jour se dit en toutes
 * lettres — « 1 J » est le moment ou on ne veut pas que le joueur compte.
 */
const ALERTE_MS = 3 * 24 * 60 * 60 * 1000;

export function Sursis({ fin, className = '' }: {
  fin?: number | null; className?: string;
}) {
  const t = Number(fin) || 0;
  if (!t) return null;
  const reste = t - Date.now();
  if (reste <= 0 || reste > ALERTE_MS) return null;
  const jours = Math.max(1, Math.ceil(reste / (24 * 60 * 60 * 1000)));
  const { N } = SprinterApp;
  return (
    <span className={`shrink-0 font-mono font-bold tracking-widest tabular-nums
                      text-[9px] text-amber-400/80 whitespace-nowrap ${className}`}
          title={N.t('serie_reste_a11y', { n: jours })}
          aria-label={N.t('serie_reste_a11y', { n: jours })}>
      {jours <= 1 ? N.t('serie_reste_1') : N.t('serie_reste', { n: jours })}
    </span>
  );
}

/**
 * La plus longue serie jamais tenue : BEST 14.
 *
 * `serie_max` etait compte, range et renvoye par le serveur depuis le premier
 * jour — et affiche nulle part. Il vaut pourtant exactement ce que la serie en
 * cours ne vaut pas : il ne s'efface jamais. C'est ce qui reste quand la
 * flamme s'eteint, et la seule raison de ne pas vivre le COMBO BREAK comme une
 * ardoise remise a zero.
 *
 * En gris, et seulement quand il depasse la serie du moment : « BEST 5 » a
 * cote de « COMBO ×5 » repeterait le meme nombre deux fois.
 */
export function MeilleureSerie({ max, serie, className = '' }: {
  max?: number | null; serie?: number | null; className?: string;
}) {
  const m = Number(max) || 0;
  if (m < SERIE_MIN || m <= (Number(serie) || 0)) return null;
  const { N } = SprinterApp;
  return (
    <span className={`shrink-0 font-mono font-bold tracking-widest tabular-nums
                      text-[9px] text-muted-foreground/70 ${className}`}
          aria-label={N.t('serie_best_a11y', { n: m })}>
      {N.t('serie_best', { n: m })}
    </span>
  );
}
