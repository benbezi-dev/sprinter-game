import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { LigneClassee } from '@/game/leaderboard';

/**
 * SON NOM QUI MONTE DANS LE CLASSEMENT, ET S'INSTALLE A SA PLACE.
 *
 * Les annonces disaient le resultat et le nombre : « 12e au TOP 500 »,
 * « +25 PL », « TU MONTES EN NATIONAL ». Exact, et plat. Ce qu'on vient
 * chercher en courant n'est pas un nombre, c'est un DEPLACEMENT — doubler
 * quelqu'un, prendre sa place, la voir tenir. Un nombre qui remplace un autre
 * nombre ne montre rien de ce mouvement : il faut le voir se produire, avec
 * les noms qu'on double, sinon on a gagne trois places contre personne.
 *
 * LE CLASSEMENT NE BOUGE PAS, C'EST LE NOM QUI TRAVERSE. L'inverse — faire
 * defiler la liste derriere un nom immobile — donne la sensation exactement
 * contraire : le monde se deplace et le joueur reste ou il etait.
 *
 * QUATRE VOISINS, ET PAS UN DE PLUS. La fenetre montre deux lignes au-dessus
 * de la nouvelle place et deux en dessous : de quoi voir qui l'on vient de
 * passer et derriere qui l'on se pose. Une liste plus longue ne raconterait
 * rien de plus et pousserait le bouton de l'annonce hors de l'ecran.
 *
 * LES GRANDS BONDS ENTRENT PAR LE BORD. Gagner deux places se montre en
 * entier ; en gagner deux cents ne se montre pas — le nom part alors du bord
 * de la fenetre, et c'est le rang qui defile qui dit la distance parcourue.
 *
 * MOUVEMENT REDUIT : LE CLASSEMENT RESTE, LE TRAJET PART. Pour une partie des
 * gens, un mouvement a l'ecran donne la nausee. Ce qu'il y a a savoir — d'ou
 * l'on vient, ou l'on est, entre quels noms — se lit tout aussi bien pose.
 */

/** Hauteur d'une ligne, en pixels. Tout le calcul du trajet en depend. */
const H = 28;
/** Combien de lignes la fenetre montre, au plus. */
const FENETRE = 5;
/** Le trajet, en secondes. */
const TRAJET = 0.85;

/**
 * Le rang qui defile pendant que le nom monte.
 *
 * Il arrive a destination avec lui : un compteur qui finit apres le nom
 * donnerait deux annonces l'une derriere l'autre au lieu d'une seule.
 */
function RangQuiDefile({ de, vers, delai }: { de: number; vers: number; delai: number }) {
  const [v, setV] = useState(de);
  useEffect(() => {
    if (de === vers) { setV(vers); return; }
    setV(de);
    let raf = 0;
    let t0 = 0;
    const pas = (t: number) => {
      if (!t0) t0 = t;
      const p = (t - t0 - delai * 1000) / (TRAJET * 1000);
      if (p > 0) {
        const q = Math.min(1, p);
        // Depart rapide, arrivee posee : le meme geste que le chrono du record.
        setV(Math.round(de + (vers - de) * (1 - Math.pow(1 - q, 3))));
        if (q >= 1) return;
      }
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [de, vers, delai]);
  return <>{v}</>;
}

export function MonteeAuClassement({
  titre, nom, rangAvant, rangApres, lignes, delai = 0.5,
}: {
  /** Quel classement : « TOP 500 », « CLASSEMENT DES DUELS ». */
  titre: string;
  /** Le nom du joueur, tel qu'il figure au tableau. */
  nom: string;
  /** Sa place d'avant. Nul quand il n'etait pas classe : c'est une entree. */
  rangAvant: number | null;
  rangApres: number;
  /** Le classement d'apres autour de cette place, SA LIGNE EXCLUE. */
  lignes: LigneClassee[];
  /** Le temps qu'on laisse a l'annonce avant de bouger, en secondes. */
  delai?: number;
}) {
  const { N } = SprinterApp;
  const doux = useReducedMotion();

  const entree = rangAvant == null;
  const monte = entree || rangApres < (rangAvant as number);
  // Une entree deplace tout ce qui est en dessous, sans distance a annoncer.
  const ecart = entree ? Infinity : Math.abs((rangAvant as number) - rangApres);

  // Deux voisins au-dessus, le reste en dessous. Pres du sommet il n'y a
  // personne au-dessus : la fenetre se remplit alors vers le bas plutot que
  // de garder des lignes vides pour respecter une symetrie que personne ne
  // regarde.
  const autres = lignes.filter(l => l.rank !== rangApres).sort((a, b) => a.rank - b.rank);
  const dessus = autres.filter(l => l.rank < rangApres).slice(-2);
  const dessous = autres.filter(l => l.rank > rangApres)
                        .slice(0, FENETRE - 1 - dessus.length);

  // Sans voisin, il n'y a pas de classement a montrer — seulement une ligne
  // seule, qui ne dirait rien de plus que le nombre deja annonce.
  if (!dessus.length && !dessous.length) return null;
  if (!entree && ecart === 0) return null;

  const monIndex = dessus.length;
  /**
   * La hauteur de la fenetre suit ce qu'il y a a montrer.
   *
   * Cinq lignes est la taille voulue, pas un minimum : un classement de trois
   * joueurs n'a pas quatre voisins a donner, et une boite calee sur cinq
   * laisserait deux emplacements vides — qu'on lirait comme des places
   * manquantes plutot que comme un tableau court.
   */
  const lignesVues = dessus.length + 1 + dessous.length;
  /** Combien de lignes le nom a devant lui, dans le sens ou il va. */
  const marge = monte ? dessous.length : dessus.length;
  /** Le depart, en lignes. Au-dela de la marge, on part du bord. */
  const bonds = Math.min(ecart, marge + 1);
  const departY = (monte ? 1 : -1) * bonds * H;
  /** Un depart hors de la fenetre : le nom y entre en apparaissant. */
  const duBord = bonds > marge;

  /** Une ligne s'est-elle fait pousser d'un cran par ce deplacement ? */
  const poussee = (l: LigneClassee) => monte
    ? l.rank > rangApres && l.rank <= rangApres + ecart
    : l.rank < rangApres && l.rank >= rangApres - ecart;

  const places = ecart === 1 ? N.t('places_1') : N.t('places_n');
  const libelle = entree ? N.t('classement_entree')
                         : `${monte ? '+' : '−'}${ecart} ${places}`;
  const dit = N.t(entree ? 'classement_entre_a11y'
                         : monte ? 'classement_bouge_a11y' : 'classement_perd_a11y',
                  { n: String(ecart), r: N.ord(rangApres), c: titre });

  const ligne = (l: LigneClassee, i: number) => (
    <motion.div
      key={`v${l.rank}`}
      className="absolute inset-x-0 flex items-center gap-2 px-2"
      style={{ top: i * H, height: H }}
      initial={doux || !poussee(l) ? false : { y: monte ? -H : H }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 110, damping: 16, delay: delai }}
    >
      <span className="w-7 shrink-0 text-right font-bold tabular-nums text-[10px] text-muted-foreground">
        {l.rank}
      </span>
      <span className="truncate text-[11px] font-bold tracking-wide text-foreground/60">
        {l.name}
      </span>
    </motion.div>
  );

  return (
    <div className="w-full flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 px-1">
        <span className="text-[9px] font-bold tracking-widest text-muted-foreground truncate">
          {titre}
        </span>
        <span className={`shrink-0 flex items-center gap-0.5 text-[9px] font-bold tracking-widest
          ${monte ? 'text-emerald-400' : 'text-destructive'}`}>
          {!entree && (monte ? <ChevronUp className="w-3 h-3" aria-hidden />
                             : <ChevronDown className="w-3 h-3" aria-hidden />)}
          {libelle}
        </span>
      </div>

      {/* La fenetre. `overflow-hidden` est ce qui fait entrer le nom par le
          bord au lieu de le laisser flotter au-dessus de l'annonce. */}
      <div className="relative w-full overflow-hidden rounded-xl border border-white/10 bg-black/30"
           style={{ height: lignesVues * H }} aria-hidden>
        {dessus.map((l, i) => ligne(l, i))}
        {dessous.map((l, i) => ligne(l, monIndex + 1 + i))}

        {/* SA LIGNE PASSE DEVANT LES AUTRES, ET ELLE EST OPAQUE.
            Une ligne translucide qui traverse laisse deux noms l'un sur
            l'autre : pendant tout le trajet, le seul qu'on cherche a lire est
            illisible. Le fond de carte est donc plein, et la teinte posee
            par-dessus — sous le texte, qui reprend la main avec `relative`. */}
        <motion.div
          className="absolute inset-x-0 mx-1 flex items-center gap-2 px-1.5 rounded-lg
                     border border-primary/50 bg-card"
          style={{ top: monIndex * H, height: H }}
          initial={doux ? false : { y: departY, opacity: duBord ? 0 : 1 }}
          animate={doux ? { y: 0, opacity: 1 } : {
            y: 0,
            opacity: 1,
            // L'eclat de l'arrivee : ce qui fait qu'elle se POSE, au lieu de
            // simplement s'arreter la.
            boxShadow: ['0 0 0px rgba(248,205,74,0)', '0 0 18px rgba(248,205,74,0.55)',
                        '0 0 0px rgba(248,205,74,0)'],
          }}
          transition={{
            y: { type: 'spring', stiffness: 110, damping: 15, delay: delai },
            opacity: { duration: 0.25, delay: delai },
            boxShadow: { duration: 0.9, delay: delai + TRAJET * 0.8, times: [0, 0.4, 1] },
          }}
        >
          <span aria-hidden className="absolute inset-0 rounded-lg bg-primary/15" />
          <span className="relative w-7 shrink-0 text-right font-black tabular-nums text-[10px] text-primary">
            {doux || entree ? rangApres
              : <RangQuiDefile de={rangAvant as number} vers={rangApres} delai={delai} />}
          </span>
          <span className="relative truncate text-[11px] font-black tracking-wide text-primary">
            {nom}
          </span>
        </motion.div>
      </div>

      {/* Une fleche et une couleur ne se lisent pas a voix haute, et « 3 »
          tout seul ne veut rien dire. La phrase entiere est ecrite ici. */}
      <span className="sr-only">{dit}</span>
    </div>
  );
}
