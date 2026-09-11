import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { MONTEE, RESSORT, SURGISSEMENT } from '@/lib/mouvement';
import { Timer, Trophy, RotateCcw, Lightbulb, Check, Play } from 'lucide-react';
import {
  useObjectif, soumettreCourse, relancerObjectif, quitterObjectif,
  minutesRestantes, fenetreFinie, s2, type Resultat, type Objectif,
} from '@/game/objectif';

/**
 * L'ECRAN DE REVANCHE.
 *
 * Il remplace l'ecran de fin ordinaire quand la course faisait partie du defi
 * du jour, et il est fait pour une seule chose : que la course suivante parte
 * avant que l'envie ne retombe.
 *
 * D'OU CE QU'IL N'A PAS. Pas de menu, pas d'onglets, pas de partage, pas de
 * classement. Un bouton pleine largeur qui relance, et un lien discret pour
 * sortir. L'ecran de fin du one shot fait tout le reste et fait tres bien —
 * mais il demande de choisir, et choisir entre huit choses apres avoir rate de
 * neuf centiemes, c'est fermer le jeu.
 *
 * CE QU'IL MONTRE, DANS L'ORDRE OU ON LE LIT. Le chrono qu'on vient de faire.
 * L'ecart chiffre a la cible — « il te manque 0,12 s » et pas « pas encore » :
 * un nombre qu'on peut viser fait relancer, un jugement fait fermer. Le
 * meilleur essai de la session, pour voir qu'on se rapproche. Et ce que la
 * prochaine course rapporterait.
 *
 * APRES TROIS ECHECS, IL CHANGE. Le meme ecran une quatrieme fois ne dit plus
 * rien : il devient un mur. On y ajoute alors UN detail, mesure sur la course
 * qu'on vient de courir — le temps perdu au depart, la transition cassee, la
 * touche repetee. Jamais un encouragement general : « accroche-toi » n'a jamais
 * fait gagner un centieme.
 */

/** Ce que la course qui vient de finir dit de mieux a corriger. */
function conseilDe(N: any, cibleMs: number, meilleurMs: number | null): string | null {
  const p = SprinterApp.G.player;
  if (!p) return null;
  const C = SprinterApp.C;

  // Un faux depart passe avant tout le reste : il coute la course entiere.
  if (p.jumped) return N.t('obj_c_faux');

  // Le depart. On ne parle que du temps REELLEMENT perdu par rapport a la
  // meilleure reaction possible, pas d'un ideal theorique.
  if (p.reaction != null && p.reaction > C.REACT_WINDOW * 0.75) {
    return N.t('obj_c_depart', { n: (p.reaction - C.REACT_BEST).toFixed(2) });
  }

  // La chute vient d'une touche repetee, et c'est la seule faute que le jeu
  // sanctionne vraiment.
  if (p.stumbledInDrive) return N.t('obj_c_chute');

  if (p.transGrade === 0) return N.t('obj_c_trans');

  // Rien de fautif : il ne manque que du rythme. On le dit avec le chiffre,
  // qui est la seule chose utile qui reste.
  if (meilleurMs != null && meilleurMs > cibleMs) {
    return N.t('obj_c_proche', { n: ((meilleurMs - cibleMs) / 1000).toFixed(2) });
  }
  return null;
}

const COULEUR_PALIER: Record<string, string> = {
  bronze: 'text-amber-600 border-amber-600/50 bg-amber-600/10',
  argent: 'text-slate-200 border-slate-300/50 bg-slate-300/10',
  or: 'text-primary border-primary/60 bg-primary/10',
};

/** Apres combien d'echecs on ajoute le detail. */
const ECHECS_AVANT_CONSEIL = 3;

export function Revanche() {
  const { state, runTime, falseOut } = useGameStore();
  const { N } = SprinterApp;
  const s = useObjectif();

  const [res, setRes] = useState<Resultat | null>(null);
  const envoye = useRef<number | null>(null);

  // La course est soumise une fois, et une seule. Le jeton est le chrono :
  // deux courses identiques a la milliseconde pres n'existent pas, et l'ecran
  // se redessine plusieurs fois avant que le serveur reponde.
  useEffect(() => {
    if (state !== 'winall' || !s.objectif) return;
    const ms = Math.round(runTime * 1000);
    if (!ms || envoye.current === ms) return;
    envoye.current = ms;
    setRes(null);
    soumettreCourse(ms).then(setRes).catch(() => { /* le jeu continue */ });
  }, [state, runTime, s.objectif]);

  if (!s.objectif) return null;

  const o = s.objectif;
  const ms = Math.round(runTime * 1000);
  const cible = o.cible_ms;
  const manque = Math.max(0, (res ? res.meilleurMs : (s.meilleurMs ?? ms)) - cible);
  const reussi = res ? res.reussi : ms <= cible;
  const palier = res ? res.palier : null;
  const minutes = minutesRestantes(o);
  const echecs = s.courses - (reussi ? 1 : 0);
  const conseil = !reussi && s.courses >= ECHECS_AVANT_CONSEIL
    ? conseilDe(N, cible, s.meilleurMs) : null;

  const relancer = () => { setRes(null); envoye.current = null; relancerObjectif(); };
  const sortir = () => { quitterObjectif(); SprinterApp.goHome(); };

  const bonus = res?.avantBonus ?? Math.max(0, ECHECS_AVANT_CONSEIL - s.courses);

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-black/85 backdrop-blur-sm
                    overflow-y-auto px-[max(env(safe-area-inset-left),1rem)]
                    pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)]
                    pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <motion.div {...MONTEE}
          className="flex flex-col items-center max-w-md w-full gap-4 py-6">

          <div className="text-[10px] font-bold tracking-[0.3em] text-muted-foreground uppercase">
            {N.t('obj_titre')}
            {minutes !== null && minutes > 0 && (
              <span className="ml-2 text-primary/70">{N.t('obj_minutes', { n: minutes })}</span>
            )}
          </div>

          {/* Le chrono, en grand. C'est la premiere chose qu'on cherche. */}
          <div className={`font-mono font-black tabular-nums text-6xl sm:text-7xl leading-none
            ${falseOut ? 'text-destructive' : reussi ? 'text-emerald-400' : 'text-foreground'}`}>
            {falseOut ? '—' : s2(ms)}
            {!falseOut && <span className="text-3xl text-primary ml-1">s</span>}
          </div>

          {/* L'ECART CHIFFRE. La ligne la plus lue de l'ecran. */}
          {!reussi && !falseOut && (
            <div className="text-base sm:text-lg font-bold text-destructive tabular-nums">
              {N.t('obj_manque', { n: (manque / 1000).toFixed(2) })}
            </div>
          )}

          {palier && (
            <motion.div {...SURGISSEMENT}
              className={`flex items-center gap-2 rounded-2xl border-2 px-4 py-2
                          ${COULEUR_PALIER[palier]}`}>
              <motion.div initial={{ rotate: -18, scale: 0.5 }} animate={{ rotate: 0, scale: 1 }}
                transition={RESSORT.trophee}>
                <Trophy className="w-5 h-5" />
              </motion.div>
              <span className="font-black font-display uppercase tracking-tight text-lg">
                {palier}
              </span>
              {res && res.points > 0 && (
                <span className="font-mono font-bold tabular-nums text-sm">
                  {N.t('obj_points', { n: res.points })}
                </span>
              )}
            </motion.div>
          )}

          {/* La cible et le meilleur de la session, cote a cote : on voit d'un
              coup d'oeil de combien on s'est rapproche. */}
          <div className="w-full grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/10 bg-card/60 px-3 py-2 flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                {N.t('obj_a_passer')}
              </span>
              <span className="font-mono font-black tabular-nums text-xl text-primary">
                {s2(cible)} s
              </span>
            </div>
            <div className="rounded-xl border border-white/10 bg-card/60 px-3 py-2 flex flex-col items-center">
              <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
                {N.t('obj_meilleur')}
              </span>
              <span className="font-mono font-black tabular-nums text-xl text-foreground">
                {s.meilleurMs === null ? '—' : `${s2(s.meilleurMs)} s`}
              </span>
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground tabular-nums">
            {s.courses === 1 ? N.t('obj_essai_1') : N.t('obj_essais', { n: s.courses })}
            {' · '}
            {bonus > 0
              ? N.t(bonus > 1 ? 'obj_bonus_n' : 'obj_bonus', { n: bonus })
              : N.t('obj_bonus_pris')}
          </div>

          {/* LE DETAIL, apres trois courses seulement. */}
          <AnimatePresence>
            {conseil && (
              <motion.div {...SURGISSEMENT}
                className="w-full rounded-2xl border border-cyan-400/40 bg-cyan-500/[0.08] px-4 py-3
                           flex gap-3 items-start">
                <Lightbulb className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                <div className="flex flex-col gap-1">
                  <span className="text-[9px] font-bold tracking-[0.25em] text-cyan-300/90 uppercase">
                    {N.t('obj_conseil')}
                  </span>
                  <span className="text-xs sm:text-sm text-foreground/90 leading-snug">
                    {conseil}
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* UN SEUL BOUTON. Il relance sans passer par rien. */}
          <button
            onClick={relancer}
            className="w-full mt-1 rounded-2xl bg-primary text-background font-black font-display
                       uppercase tracking-tight text-2xl sm:text-3xl py-5
                       flex items-center justify-center gap-3
                       shadow-[0_0_40px_rgba(248,205,74,0.3)]
                       active:scale-[0.98] transition-transform"
          >
            <RotateCcw className="w-6 h-6" />
            {reussi ? N.t('obj_encore') : N.t('obj_revanche')}
          </button>

          <button onClick={sortir}
            className="text-[11px] uppercase tracking-widest text-muted-foreground
                       hover:text-foreground transition-colors py-2">
            {N.t('obj_quitter')}
          </button>
        </motion.div>
      </div>
    </div>
  );
}
/**
 * L'entree dans les defis, posee sur l'accueil.
 *
 * UNE CARTE, UNE SEULE LIGNE. Les trois defis — un par distance ou le joueur
 * est classe — restent trois defis distincts, mais ils ne s'empilent plus :
 * un selecteur 100 / 200 / 400 choisit la distance, la ligne montre SA cible
 * et UN bouton la court. Trois lignes identiques se lisaient comme un tableau
 * et poussaient le selecteur de mode sous la ligne de flottaison ; une ligne
 * se lit comme une action.
 *
 * LE SELECTEUR PLUTOT QU'UN MENU. Trois choix tiennent a l'ecran : les montrer
 * dit qu'il y a trois defis, et on change de distance en un geste au lieu de
 * deux. Un point vert marque une distance deja reussie.
 *
 * LA DISTANCE PROPOSEE D'ABORD est la premiere qui n'est pas encore reussie :
 * rouvrir l'accueil sur un defi valide, c'est proposer de refaire ce qui est
 * fait.
 *
 * Rien ne s'affiche s'il n'y a rien : hors fenetre, hors classement, ou
 * serveur muet, la carte disparait plutot que d'annoncer un defi qui n'existe
 * pas. Le temps restant, lui, est le meme pour les trois — c'est un creneau,
 * pas trois — et se dit donc une seule fois, en tete.
 */
export function CarteObjectif({ onLancer, onFin }: {
  onLancer: (o: Objectif) => void;
  /** Le creneau vient de se fermer : de quoi redemander les defis du suivant. */
  onFin?: () => void;
}) {
  const { N } = SprinterApp;
  const s = useObjectif();
  const [choisie, setChoisie] = useState<string | null>(null);
  const liste = s.objectifs.length ? s.objectifs : (s.objectif ? [s.objectif] : []);

  const o = liste.find(x => x.epreuve === choisie)
    ?? liste.find(x => !x.valide)
    ?? liste[0]
    ?? null;

  // L'HORLOGE, ET CE QU'ELLE NE FAIT PAS. Elle ne decremente rien : la valeur
  // affichee se recalcule depuis `expire_le` a chaque rendu. Un compteur qu'on
  // decremente derive des que l'onglet passe en arriere-plan — le telephone
  // gele les minuteurs, il ne gele pas l'heure — et l'accueil affichait « 12
  // min avant la fin » sur un creneau clos depuis une heure.
  //
  // Dix secondes et pas une : le decompte se dit a la minute, et rien d'autre
  // ne bouge entre deux battements. Une seconde ferait redessiner l'ecran le
  // plus regarde du jeu soixante fois par minute pour un chiffre qui change
  // une fois.
  const fenetre = liste[0]?.expire_le ?? null;
  const [, battement] = useState(0);
  useEffect(() => {
    if (!fenetre) return;
    const id = setInterval(() => battement(n => n + 1), 10_000);
    return () => clearInterval(id);
  }, [fenetre]);

  // ET UN REVEIL POSE SUR LA SECONDE DE LA FERMETURE. Le battement de dix
  // secondes suffit a un chiffre qui change une fois par minute, pas au
  // bouton : il resterait jaune jusqu'a dix secondes apres la fin, et une
  // course lancee dans cet intervalle part pour un defi que le serveur
  // refusera. Le minuteur, lui, tombe juste.
  useEffect(() => {
    if (!fenetre) return;
    const dans = fenetre - Date.now();
    if (dans <= 0) return;
    const t = setTimeout(() => battement(n => n + 1), dans + 50);
    return () => clearTimeout(t);
  }, [fenetre]);

  // LE CRENEAU SE FERME PENDANT QU'ON REGARDE L'ACCUEIL. Sans cela le bouton
  // restait jaune et lancait une course pour un defi que le serveur refuse.
  // On le dit UNE fois — pas a chaque battement — et le drapeau se rearme
  // quand un creneau neuf ouvre : la carte vit plus longtemps que le creneau
  // qu'elle montre.
  const fini = fenetreFinie(liste[0] ?? null);
  const prevenu = useRef(false);
  useEffect(() => {
    if (!fini) { prevenu.current = false; return; }
    if (prevenu.current) return;
    prevenu.current = true;
    onFin?.();
  }, [fini, onFin]);

  if (!o) return null;

  const minutes = minutesRestantes(liste[0]);

  // Les fleches deplacent le choix, comme dans tout groupe de boutons radio.
  const auClavier = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const i = liste.indexOf(o);
    const n = liste.length;
    const suivant = liste[(i + (e.key === 'ArrowRight' ? 1 : -1) + n) % n];
    setChoisie(suivant.epreuve);
    const bouton = e.currentTarget.querySelector<HTMLButtonElement>(`[data-epreuve="${suivant.epreuve}"]`);
    bouton?.focus();
  };

  return (
    <div className="w-full rounded-2xl border-2 border-primary/50 bg-primary/[0.08]
                    px-4 py-3 flex flex-col gap-2.5">
      <span className="text-[9px] font-bold tracking-[0.25em] text-primary uppercase
                       flex items-center gap-2">
        <Timer className="w-4 h-4 shrink-0" />
        <span className="truncate">{N.t('obj_titre')}</span>
        {(fini || (minutes !== null && minutes > 0)) && (
          <span className="ml-auto shrink-0 text-muted-foreground">
            {fini ? N.t('obj_fini') : N.t('obj_minutes', { n: minutes })}
          </span>
        )}
      </span>

      <div className="flex items-center gap-2">
        {/* LA DISTANCE. Seule, elle se dit ; a plusieurs, elle se choisit. */}
        {liste.length > 1 ? (
          <div role="radiogroup" aria-label={N.t('obj_distance')} onKeyDown={auClavier}
            className="shrink-0 flex rounded-xl border border-primary/30 bg-white/[0.06] p-[3px]">
            {liste.map(x => {
              const actif = x.epreuve === o.epreuve;
              return (
                <button key={x.epreuve} type="button" role="radio"
                  data-epreuve={x.epreuve}
                  aria-checked={actif} tabIndex={actif ? 0 : -1}
                  aria-label={`${x.epreuve} m`}
                  onClick={() => setChoisie(x.epreuve)}
                  className={`relative w-9 py-2 rounded-lg font-display font-black text-sm
                              tabular-nums transition-colors
                              ${actif ? 'text-background' : 'text-muted-foreground hover:text-foreground'}`}>
                  {actif && (
                    <motion.span layoutId="obj-pastille" transition={RESSORT.rang}
                      className="absolute inset-0 rounded-lg bg-primary" />
                  )}
                  <span className="relative">{x.epreuve}</span>
                  {x.valide && (
                    <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <span className="shrink-0 font-display font-black text-primary text-sm tabular-nums">
            {o.epreuve} M
          </span>
        )}

        {/* LA CIBLE de la distance choisie. */}
        <span className="flex-1 min-w-0 flex flex-col leading-none" aria-live="polite">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={o.epreuve}
              initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              className="font-mono font-black tabular-nums text-lg text-foreground whitespace-nowrap">
              {s2(o.cible_ms)} s
            </motion.span>
          </AnimatePresence>
          <span className={`mt-1 text-[10px] font-bold uppercase tracking-widest whitespace-nowrap
                            flex items-center gap-1
                            ${o.valide ? 'text-emerald-300' : 'text-muted-foreground'}`}>
            {o.valide && <Check className="w-3 h-3 shrink-0" />}
            {o.valide ? N.t('obj_reussi') : N.t('obj_a_battre')}
          </span>
        </span>

        {/* UN SEUL BOUTON. Il court le defi affiche, reussi ou pas — et il
            s'eteint avec le creneau plutot que de disparaitre : une carte qui
            s'evapore sous le doigt se lit comme un bug, un bouton gris se lit
            comme une echeance. */}
        <button type="button" onClick={() => onLancer(o)} disabled={fini}
          aria-label={N.t('obj_lancer')}
          className={`shrink-0 rounded-full font-display font-black
                     uppercase tracking-wide text-sm px-3.5 py-2.5 flex items-center gap-1.5
                     transition-transform
            ${fini
              ? 'bg-white/10 text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-background active:scale-[0.96]'}`}>
          <Play className="w-3.5 h-3.5 fill-current" />
          <span className="max-[379px]:hidden">{N.t('obj_courir')}</span>
        </button>
      </div>
    </div>
  );
}
