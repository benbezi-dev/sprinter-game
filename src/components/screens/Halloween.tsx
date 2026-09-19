import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { MONTEE } from '@/lib/mouvement';
import { editionActive, EDITION_HALLOWEEN } from '@/game/edition';
import {
  NUITS, nuitDe, nuitOuverte, carnet, chronoDe, etapeDuCimetiere,
  armerLaNuit, rangerLaNuit, nuitEnCours, nuitCourante, etatDeLaChasse,
  tenirLaNuit, compterLaMorsure, tirerLaScene, toutesTenues,
} from '@/game/halloween';
import {
  CLES_TENUES, CLES_MORSURES, sceneDe, dit, peindreLaScene,
} from '@/game/halloween-cinema';
import { mot, chrono } from '@/game/halloween-mots';
import { chargerLaMusique } from '@/game/halloween-musique';

/* ---------------------------------------------------------------------------
   LA NUIT DU MOLOSSE — les trois ecrans du mode
   ---------------------------------------------------------------------------
   Une banderole sur l'accueil, un tableau des treize nuits, et ce qu'on
   raconte apres la course. Rien de plus : le mode n'a ni classement, ni duel,
   ni onglet dans le vestiaire — il se joue seul, contre une bete, et il se
   ferme comme il s'ouvre.

   LE MODE SE POSE SUR LE ONE SHOT, il ne s'en fabrique pas un autre. Une nuit
   EST un 100 m au cimetiere municipal, lance par `startOneShot` comme
   n'importe quel 100 m ; ce qui la distingue tient dans ce que
   `armerLaNuit` ajoute par-dessus. Un mode qui aurait pose sa propre boucle de
   course aurait perdu au passage le faux depart, la pause, l'enregistrement de
   la trace, le film de la course et les records — tout ce que le one shot
   sait faire et dont personne ici n'a envie de se souvenir.
--------------------------------------------------------------------------- */

/* --- le panneau ouvert ou ferme --------------------------------------------
   Un etat de module plutot qu'un contexte React : deux composants le lisent,
   il change trois fois par session, et le porter dans l'arbre aurait demande
   un fournisseur au-dessus de tout le jeu pour un booleen. */
let ouvert = false;
const abonnes = new Set<() => void>();
function poserOuvert(v: boolean) {
  if (ouvert === v) return;
  ouvert = v;
  // LE MORCEAU SE DEMANDE EN OUVRANT LE TABLEAU, pas au lancement de la
  // course : il reste alors quelques secondes — le temps de choisir une nuit
  // — pour que sept cents kilo-octets arrivent et se decodent. Demande au
  // coup de pistolet, il serait pret vers la troisieme foulee.
  //
  // L'appel ne bloque rien et son echec ne se voit pas : sans lui, la course
  // part sur la musique ordinaire.
  if (v) void chargerLaMusique();
  for (const f of abonnes) f();
}
function usePanneau(): boolean {
  return useSyncExternalStore(
    (l) => { abonnes.add(l); return () => { abonnes.delete(l); }; },
    () => ouvert, () => ouvert,
  );
}

/** Lancer une nuit : un 100 m au cimetiere, avec la bete par-dessus. */
function partir(n: number) {
  poserOuvert(false);
  (SprinterApp as any).startOneShot(['100'], { levelIdx: etapeDuCimetiere() });
  // APRES `startOneShot`, ET PAS AVANT. C'est lui qui construit la course, et
  // la construction range les obstacles de la precedente — une bete armee
  // avant aurait ete balayee par le menage du 100 m qu'on vient de demander.
  armerLaNuit(n);
}

/* ===========================================================================
   LA BANDEROLE DE L'ACCUEIL
   =========================================================================== */

/**
 * L'annonce du mode, en haut de la colonne de l'accueil.
 *
 * ELLE SUIT LA FENETRE, MAIS ELLE NE REPREND RIEN. Pendant les dix jours de
 * l'edition, elle s'affiche a tout le monde. Passe la fenetre, elle disparait
 * pour ceux qui n'y ont jamais touche — et elle RESTE, plus discrete, pour
 * ceux qui ont commence : treize nuits ne se tiennent pas en une semaine, et
 * un joueur arrive a la neuvieme le 3 novembre n'a pas a decouvrir le
 * 4 novembre que son chemin vers les quatre dernieres a ete retire.
 */
export function BanderoleMolosse() {
  const c = carnet();
  const dansLaFenetre = editionActive(EDITION_HALLOWEEN);
  const commence = c.tenues > 0 || c.morsures > 0;
  if (!dansLaFenetre && !commence) return null;

  const n = nuitOuverte();
  const fini = toutesTenues();

  return (
    <motion.div {...MONTEE}>
      <button
        onClick={() => poserOuvert(true)}
        className="w-full rounded-2xl border-2 px-4 py-3 flex items-center gap-3 text-left
                   border-[#E86826]/70 bg-[#150C1E]/85 hover:bg-[#20122E]/90 transition-colors"
      >
        {/* Deux yeux dans le noir. Aucune icone de bibliotheque ne dit « une
            bete te regarde depuis l'obscurite », et un emoji de citrouille
            aurait fait de ce mode une decoration de saison. */}
        <span className="shrink-0 w-9 h-9 rounded-full bg-[#0B0710] border-2 border-[#E86826]/50
                         flex items-center justify-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5430] shadow-[0_0_6px_#FF5430]" />
          <span className="w-1.5 h-1.5 rounded-full bg-[#FF5430] shadow-[0_0_6px_#FF5430]" />
        </span>

        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">
            {mot('hw_sur')}
          </span>
          <span className="font-bold text-sm md:text-base leading-tight text-foreground">
            {mot('hw_titre')}
          </span>
          <span className="text-[10px] md:text-xs text-foreground/65 leading-snug">
            {fini ? mot('hw_toutes_sous') : mot('hw_sous')}
          </span>
        </span>

        <span className="shrink-0 flex flex-col items-end gap-1">
          <span className="px-2 py-1 rounded-lg bg-[#E86826] text-black text-[10px] font-black tracking-widest">
            {commence ? mot('hw_reprendre') : mot('hw_courir')}
          </span>
          {!fini && (
            <span className="text-[9px] text-foreground/50 tracking-wide">
              {mot('hw_nuit_n', { n: String(n) })}
            </span>
          )}
        </span>
      </button>
    </motion.div>
  );
}

/* ===========================================================================
   LE TABLEAU DES TREIZE NUITS
   =========================================================================== */

/**
 * Le panneau du mode : la regle, puis les treize nuits.
 *
 * ON PEUT REJOUER N'IMPORTE QUELLE NUIT DEJA TENUE. Une echelle qui ne
 * laisserait courir que le palier suivant transformerait les douze premieres
 * en couloir a sens unique ; or c'est la qu'est le jeu — revenir sur la nuit 4
 * pour y poser deux dixiemes de moins est exactement ce qu'on a envie de faire
 * quand la nuit 9 resiste.
 */
export function PanneauMolosse() {
  const affiche = usePanneau();
  const state = useGameStore(s => s.state);
  const c = carnet();
  const ouverte = nuitOuverte();

  // Le panneau appartient a l'accueil : une course lancee le referme, et il ne
  // se rouvre pas par-dessus une piste montee.
  if (!affiche || (state !== 'title' && state !== 'open')) return null;

  return (
    <div className="absolute inset-0 z-40 flex items-end sm:items-center justify-center
                    bg-black/70 backdrop-blur-sm pointer-events-auto p-0 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
        className="w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl
                   border-2 border-[#E86826]/50 bg-[#0D0814] px-5 pt-5
                   pb-[max(env(safe-area-inset-bottom),1.25rem)]"
      >
        <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">
          {mot('hw_sur')}
        </div>
        <h2 className="font-black font-display text-2xl sm:text-3xl uppercase leading-none
                       text-[#F8A02E] mb-3">
          {mot('hw_titre')}
        </h2>

        {/* LA REGLE, DITE UNE FOIS ET EN ENTIER. Elle tient en trois phrases,
            et elle merite d'etre lue avant la premiere nuit plutot que devinee
            pendant. Elle disparait des qu'une nuit a ete tenue : on ne
            reexplique pas a quelqu'un qui joue. */}
        {c.tenues === 0 && (
          <div className="rounded-xl border border-[#E86826]/25 bg-[#160D22] px-3 py-2.5 mb-4">
            <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-[#E86826] mb-1">
              {mot('hw_regle_titre')}
            </div>
            <p className="text-[11px] leading-snug text-foreground/75">{mot('hw_regle')}</p>
          </div>
        )}

        <div className="text-[9px] font-bold tracking-[0.2em] uppercase text-foreground/45 mb-2">
          {mot('hw_nuits')}
        </div>

        <div className="flex flex-col gap-1.5">
          {NUITS.map(nuit => {
            const tenue = nuit.n <= c.tenues;
            const jouable = nuit.n <= ouverte;
            const best = chronoDe(nuit.n);
            return (
              <div key={nuit.n}
                   className={`rounded-xl border px-3 py-2 flex items-center gap-3
                     ${jouable ? 'border-[#E86826]/35 bg-[#160D22]'
                               : 'border-white/5 bg-white/[0.02] opacity-50'}`}>
                <span className={`shrink-0 w-7 text-center font-black font-display text-lg
                  ${tenue ? 'text-[#7CD04E]' : jouable ? 'text-[#F8A02E]' : 'text-foreground/30'}`}>
                  {nuit.n}
                </span>
                <span className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className="font-bold text-xs text-foreground truncate">
                    {dit(nuit.nom)}
                  </span>
                  <span className="text-[10px] text-foreground/55 font-mono tabular-nums">
                    {jouable ? mot('hw_imparti', { s: chrono(nuit.imparti) })
                             : mot('hw_verrouille')}
                    {best !== null && <> · {mot('hw_meilleur', { s: chrono(best) })}</>}
                  </span>
                </span>
                {jouable && (
                  <button
                    onClick={() => partir(nuit.n)}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-[#E86826] text-black
                               text-[10px] font-black tracking-widest active:scale-95 transition-transform"
                  >
                    {tenue ? mot('hw_encore') : mot('hw_partir')}
                  </button>
                )}
                {tenue && !jouable && (
                  <span className="shrink-0 text-[9px] font-black tracking-widest text-[#7CD04E]">
                    {mot('hw_tenue')}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <button
          onClick={() => poserOuvert(false)}
          className="w-full mt-4 py-2.5 rounded-xl border border-white/10 text-foreground/60
                     text-[11px] font-bold tracking-widest uppercase"
        >
          {mot('hw_fermer')}
        </button>
      </motion.div>
    </div>
  );
}

/* ===========================================================================
   CE QU'ON RACONTE APRES
   =========================================================================== */

/** Combien de temps s'ecoule entre deux lignes de la scenette, en secondes. */
const LIGNE = 1.9;

/**
 * L'ecran de fin d'une nuit : la scenette, puis la suite.
 *
 * IL REMPLACE LE RECAPITULATIF DU ONE SHOT, il ne se pose pas dessus. Le
 * tableau ordinaire propose huit choses — refaire, defier, partager, voir le
 * classement — et aucune n'a de sens ici : on vient de se faire arracher une
 * oreille, la seule question est de savoir si l'on y retourne.
 */
export function FinDeLaNuit() {
  const state = useGameStore(s => s.state);
  // Ce qui manquait au COUREUR, et non a la bete. Les deux sont au meme point
  // a l'instant de la morsure, donc l'un valait l'autre — mais lire la
  // position du chien pour parler de la course du joueur est le genre de
  // raccourci qui devient faux le jour ou la morsure change de regle.
  const joueur = useGameStore(s => s.player);
  const toile = useRef<HTMLCanvasElement | null>(null);
  const [t, setT] = useState(0);
  const depart = useRef(0);
  const [scene] = useState(() => {
    const c = etatDeLaChasse();
    const mordu = !c || c.verdict !== 'passe';
    return { mordu, cle: tirerLaScene(mordu ? CLES_MORSURES : CLES_TENUES) };
  });

  const c = etatDeLaChasse();
  const nuit = nuitCourante();

  // LE RESULTAT SE RANGE UNE SEULE FOIS, au montage de cet ecran. Le poser
  // dans la boucle de course aurait compte une morsure a chaque image ou la
  // bete tient le joueur ; le poser au demontage l'aurait perdu si le joueur
  // ferme l'onglet. Ici, il est ecrit au moment ou la nuit se termine, et une
  // seule fois — React ne monte cet ecran qu'une fois par course.
  useEffect(() => {
    const e = etatDeLaChasse();
    if (!e || !nuit) return;
    if (e.verdict === 'passe') tenirLaNuit(nuit.n, e.chrono);
    else compterLaMorsure();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // L'horloge de la scenette. Elle tourne sur sa propre boucle : le chrono de
  // la course est fige depuis l'arrivee, et la scene doit continuer a vivre.
  useEffect(() => {
    let vivant = true;
    depart.current = performance.now();
    const battre = () => {
      if (!vivant) return;
      setT((performance.now() - depart.current) / 1000);
      requestAnimationFrame(battre);
    };
    requestAnimationFrame(battre);
    return () => { vivant = false; };
  }, []);

  // Le decor de la scenette, peint sur sa propre toile.
  useEffect(() => {
    const el = toile.current;
    if (!el) return;
    const ctx = el.getContext('2d');
    if (!ctx) return;
    const r = Math.min(window.devicePixelRatio || 1, 2);
    const L = el.clientWidth, H = el.clientHeight;
    if (el.width !== L * r || el.height !== H * r) {
      el.width = Math.max(1, Math.round(L * r));
      el.height = Math.max(1, Math.round(H * r));
    }
    ctx.setTransform(r, 0, 0, r, 0, 0);
    peindreLaScene(ctx, L, H, t, scene.mordu);
  }, [t, scene.mordu]);

  if (state !== 'winall' || !nuitEnCours() || !nuit) return null;

  const s = sceneDe(scene.cle, scene.mordu);
  const visibles = Math.min(s.lignes.length, Math.floor(Math.max(0, t - 0.6) / LIGNE) + 1);
  const finie = t > 0.6 + s.lignes.length * LIGNE;

  const passe = !!c && c.verdict === 'passe';
  const suivante = nuit.n < NUITS.length ? nuit.n + 1 : null;

  const sortir = () => { rangerLaNuit(); (SprinterApp as any).goHome(); };
  const rejouer = (n: number) => { rangerLaNuit(); partir(n); };

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto bg-[#0B0710]">
      <canvas ref={toile} className="absolute inset-0 w-full h-full" />

      {/* LE VERDICT, EN HAUT. Trois mots et un chrono : c'est ce que le joueur
          cherche en premier, et la scenette n'a pas a le lui faire attendre.
          L'histoire vient ensuite, et elle a tout son temps. */}
      <div className="absolute inset-x-0 top-0 px-5 pt-[max(env(safe-area-inset-top),1.25rem)]
                      flex flex-col items-center gap-0.5">
        <span className={`font-black font-display text-2xl sm:text-3xl uppercase tracking-tight
                          drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]
                          ${passe ? 'text-[#7CD04E]' : 'text-destructive'}`}>
          {passe ? mot('hw_passe') : mot('hw_mordu')}
        </span>
        <span className="font-mono tabular-nums text-sm text-foreground/80
                         drop-shadow-[0_2px_8px_rgba(0,0,0,0.95)]">
          {passe && c
            ? <>{mot('hw_chrono', { s: chrono(c.chrono) })}
                {' · '}
                {mot('hw_marge', { s: chrono(Math.max(0, nuit.imparti - c.chrono)) })}</>
            : <>{mot('hw_manque', {
                m: Math.max(0, 100 - Math.max(0, joueur ? joueur.d : 0)).toFixed(0),
              })}</>}
        </span>
      </div>

      {/* LA CARTE DE TEXTE. Sa mise en forme est celle des cinematiques du jeu
          (voir CutScreen) : meme carte sombre, meme filet de couleur a gauche,
          meme place a l'ecran. Une scenette d'Halloween qui aurait invente sa
          propre boite aurait eu l'air d'un morceau rapporte — le mode est une
          edition du jeu, pas un autre jeu. */}
      <div className="absolute z-10 overflow-hidden rounded-2xl border border-white/10
                      bg-[rgba(9,7,16,0.86)] shadow-[0_18px_48px_rgba(0,0,0,0.5)]
                      pl-5 pr-4 py-3 sm:pl-6 sm:pr-5 sm:py-4 md:pl-8 md:pr-7 md:py-6
                      portrait:left-4 portrait:right-4 portrait:bottom-[calc(max(env(safe-area-inset-bottom),1.25rem)+4.5rem)]
                      landscape:left-[45vw] landscape:top-[12vh] landscape:w-[min(46vw,38rem)]">
        <div className="absolute left-0 top-0 bottom-0 w-1 md:w-1.5"
             style={{ backgroundColor: passe ? '#7CD04E' : '#E86826' }} />
        <div className="text-[10px] sm:text-xs font-bold tracking-widest uppercase mb-1 md:mb-2"
             style={{ color: passe ? '#7CD04E' : '#E86826' }}>
          {dit(s.sur)}
        </div>
        <h2 className="text-2xl sm:text-3xl md:text-4xl font-black font-display tracking-tight
                       uppercase leading-[0.95] text-foreground">
          {dit(s.titre)}
        </h2>
        <div className="h-1 w-11/12 mt-2 md:mt-3"
             style={{ backgroundColor: passe ? '#7CD04E' : '#E86826' }} />
        <div className="mt-3 flex flex-col gap-1.5">
          <AnimatePresence>
            {s.lignes.slice(0, visibles).map((l, k) => (
              <motion.p key={k}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className="text-[12px] sm:text-sm md:text-base leading-snug text-foreground/85">
                {dit(l)}
              </motion.p>
            ))}
          </AnimatePresence>
        </div>
      </div>

      {/* LES BOUTONS N'ARRIVENT QU'A LA FIN DE L'HISTOIRE. Poses tout de suite,
          ils auraient tue la scenette : personne ne lit quatre lignes quand un
          bouton « ENCORE » attend deja sous son pouce. */}
      <AnimatePresence>
        {finie && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      className="absolute inset-x-0 bottom-0 px-4
                                 pb-[max(env(safe-area-inset-bottom),1rem)] flex gap-2">
            <button onClick={sortir}
                    className="flex-1 py-3 rounded-xl border border-white/15 bg-black/50
                               text-foreground/70 text-[11px] font-black tracking-widest uppercase">
              {mot('hw_sortir')}
            </button>
            {passe && suivante ? (
              <button onClick={() => rejouer(suivante)}
                      className="flex-[2] py-3 rounded-xl bg-[#E86826] text-black
                                 text-[11px] font-black tracking-widest uppercase active:scale-95
                                 transition-transform">
                {mot('hw_suivante')}
              </button>
            ) : (
              <button onClick={() => rejouer(nuit.n)}
                      className="flex-[2] py-3 rounded-xl bg-[#E86826] text-black
                                 text-[11px] font-black tracking-widest uppercase active:scale-95
                                 transition-transform">
                {mot('hw_encore')}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Les treize nuits tombees : on le dit ici, une fois, et le mode ne
          change rien d'autre — le cimetiere reste ouvert et les nuits se
          rejouent. Une recompense qui fermerait quoi que ce soit apres coup
          serait exactement ce que ce jeu ne fait jamais. */}
      {passe && !suivante && toutesTenues() && finie && (
        <div className="absolute inset-x-0 top-[38%] text-center px-6 pointer-events-none">
          <span className="font-black font-display text-lg sm:text-xl uppercase text-[#7CD04E]
                           drop-shadow-[0_2px_10px_rgba(0,0,0,0.95)]">
            {mot('hw_toutes')}
          </span>
        </div>
      )}
    </div>
  );
}

/** Le mode a-t-il quelque chose a afficher a la place de l'ecran de fin ? */
export function finDeNuitEnCours(): boolean { return nuitEnCours(); }

/** Fermer le panneau — appele quand le jeu quitte l'accueil par un autre chemin. */
export function fermerLeMolosse() { poserOuvert(false); }
