import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useInView } from 'motion/react';
import { Loader2, Swords, Check, Skull, RotateCcw, ArrowLeftRight, UserPlus, Ghost, Crosshair } from 'lucide-react';
import { MONTEE, VOILE, PANNEAU, RESSORT, COURBE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  CAMPS, EPREUVES, NOM_CAMP, fetchMarques, choisirCamp, monInscription, ecouterMarques, manque,
  changerEpreuve, fetchFantome, ecouterDuels,
  secondes, somme, type Camp, type Epreuve, type TableauMarques, type ChoixRefuse, type Inscription,
  type LigneFil, type VerdictDuel,
} from '@/game/marques';
import { KO, jouer } from '@/game/marques-son';
import { useRetour } from '@/hooks/use-retour';
import FaceAFace from './DuelMarquesIntro';
import { TchatMarques } from './TchatMarques';
import { surCourrier, reprendreTouchee } from '@/game/boite';

/* ---------------------------------------------------------------------------
   LE DUEL DES MARQUES — Team adidas contre Team Nike (09/10/2026).

   La banniere de l'accueil, puis l'ecran : choisir son camp et son epreuve
   (une fois), voir le score epreuve par epreuve et les coureurs qui comptent.
   Les regles sont dans worker/src/marques.js.

   LE 200 ET LE 400 M SONT MIS EN AVANT (voulu par l'auteur) : le 100 m attire
   le plus de monde, mais une place s'y gagne au chrono ; au 200 et au 400 m,
   un camp en retard d'effectif ouvre une place au premier qui vient. L'ecran
   le dit, epreuve par epreuve, au moment du choix et sous le score.

   EN MOUVEMENT (demande de l'auteur, 09/10) : la banniere se bat — reflet qui
   passe, epees qui s'entrechoquent, bouton qui bat ; l'ecran s'ouvre comme un
   face-a-face — les deux noms entrent chacun par son bord, le VS tombe, les
   totaux defilent jusqu'a leur valeur, une corde tiree montre qui mene. Que
   transform et opacite ; rien pour qui a demande moins d'animations ; les
   boucles s'arretent hors de l'ecran.

   LA BATAILLE (13/10) : l'ecran s'ouvre sur un face-a-face plein ecran
   (DuelMarquesIntro.tsx) ; chaque coureur de son epreuve se defie en fantome,
   adversaire ou coequipier ; « tes cibles » propose les plus proches ; un
   fantome adverse battu elimine son coureur (K.O.), la victime peut se
   venger ; le fil de la bataille raconte tout ; on peut changer d'epreuve en
   perdant ce qu'on avait fait sur l'ancienne. Les regles : worker/src/
   marques.js.

   AUCUN LOGO ET AUCUNE COULEUR DE MARQUE : un camp en blanc, l'autre dans le
   jaune du jeu. Et la mention de non-affiliation, sur l'ecran de choix puis
   sous le tableau — Sprinter n'est lie ni a adidas ni a Nike.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const TEINTE: Record<Camp, string> = { adidas: '#FFFFFF', nike: '#FFD426' };
const HALO: Record<Camp, string> = { adidas: 'rgba(255,255,255,0.55)', nike: 'rgba(255,212,38,0.6)' };
const NOM_EPREUVE: Record<Epreuve, string> = { '100': '100 m', '200': '200 m', '400': '400 m' };

/** Le battement d'un bouton qui appelle : deux coups, puis rien. */
const BATTEMENT = { scale: [1, 1.08, 1, 1.05, 1, 1] };
const BATTEMENT_T = { duration: 1.6, times: [0, 0.08, 0.18, 0.26, 0.4, 1], repeat: Infinity, ease: 'easeOut' as const };

function useFr() {
  const { N } = SprinterApp;
  return N.getLang() === 'fr';
}

/** Les boucles ne tournent que si l'element est a l'ecran et que le joueur
 *  n'a pas demande moins d'animations. */
function useVivant<T extends Element>() {
  const ref = useRef<T>(null);
  const vu = useInView(ref, { amount: 0.2 });
  const reduit = useAnimationsReduites();
  return { ref, vivant: vu && !reduit, reduit };
}

/** Un nombre qui defile jusqu'a sa valeur, au lieu d'y sauter. */
function useCompteur(cible: number, reduit: boolean): number {
  const [v, setV] = useState(reduit ? cible : 0);
  const dernier = useRef(0);
  useEffect(() => {
    if (reduit) { setV(cible); dernier.current = cible; return; }
    const c = animate(dernier.current, cible, {
      duration: 1.1, ease: COURBE.elan as any,
      onUpdate: x => { dernier.current = x; setV(x); },
    });
    return () => c.stop();
  }, [cible, reduit]);
  return v;
}

/** Le tableau, relu a l'ouverture et apres chaque course envoyee. Un echec
 *  se retente seul toutes les 5 s, et tout de suite au retour du reseau ou
 *  de l'onglet : le message promet « dans un instant », il doit le tenir
 *  sans qu'il faille fermer et rouvrir l'ecran (constat du 13/10). */
const NOUVEL_ESSAI_MS = 5000;
function useTableau() {
  const [t, setT] = useState<TableauMarques | null>(null);
  const [erreur, setErreur] = useState(false);
  const [essai, setEssai] = useState(false);
  const minuterie = useRef<ReturnType<typeof setTimeout> | null>(null);
  const monte = useRef(true);
  const relire = useCallback(() => {
    if (minuterie.current) { clearTimeout(minuterie.current); minuterie.current = null; }
    setEssai(true);
    fetchMarques()
      .then(x => { if (monte.current) { setT(x); setErreur(false); } })
      .catch(() => {
        if (!monte.current) return;
        setErreur(true);
        minuterie.current = setTimeout(relire, NOUVEL_ESSAI_MS);
      })
      .finally(() => { if (monte.current) setEssai(false); });
  }, []);
  useEffect(() => {
    monte.current = true;
    relire();
    const quitter = ecouterMarques(relire);
    const revenu = () => { if (minuterie.current && document.visibilityState === 'visible') relire(); };
    window.addEventListener('online', revenu);
    document.addEventListener('visibilitychange', revenu);
    return () => {
      monte.current = false;
      quitter();
      window.removeEventListener('online', revenu);
      document.removeEventListener('visibilitychange', revenu);
      if (minuterie.current) clearTimeout(minuterie.current);
    };
  }, [relire]);
  return { t, erreur, essai, relire };
}

const MENTION_FR = 'Sprinter n’est ni affilié à adidas ni à Nike, ni soutenu par eux. Les deux noms désignent seulement les équipes que les joueurs choisissent.';
const MENTION_EN = 'Sprinter is not affiliated with, or endorsed by, adidas or Nike. The two names only label the teams players choose.';

const Mention = ({ fr }: { fr: boolean }) => (
  <p className="w-full text-[9px] text-muted-foreground/60 text-center leading-snug px-4">{fr ? MENTION_FR : MENTION_EN}</p>
);

/** Un reflet qui traverse son parent, de gauche a droite, toutes les `periode` secondes. */
function Reflet({ vivant, periode = 4.5, delai = 1 }: { vivant: boolean; periode?: number; delai?: number }) {
  if (!vivant) return null;
  return (
    <motion.div aria-hidden className="absolute inset-y-0 -left-1/3 w-1/3 pointer-events-none"
      style={{ background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.22), transparent)', skewX: -18 }}
      initial={{ x: '-120%' }}
      animate={{ x: ['-120%', '420%'] }}
      transition={{ duration: 1.1, ease: 'easeInOut', repeat: Infinity, repeatDelay: periode, delay: delai }} />
  );
}

/* ---------------------------------------------------------------- l'accueil */

/**
 * UNE COURSE PARTIE DE CET ECRAN Y RAMENE (14/10, « retour me ramene au menu
 * principal du jeu et pas dans le menu de l'evenement »). Toute fin de course
 * passe par l'accueil (goHome, sprinter-app.js), qui remonte la banniere
 * fermee : on retient donc au depart qu'il faudra rouvrir l'ecran, et la
 * banniere le rouvre en revenant — duel gagne, perdu ou abandonne.
 */
let rouvrirAuRetour = false;

export function BanderoleMarques() {
  const fr = useFr();
  const [ouvert, setOuvert] = useState(rouvrirAuRetour);
  // rouvert en revenant d'une course : pas de face-a-face, on l'a deja vu
  const [retour, setRetour] = useState(rouvrirAuRetour);
  useEffect(() => { rouvrirAuRetour = false; }, []);
  // une notification du tchat touchee : l'ecran s'ouvre directement sur le tchat
  const [tchat, setTchat] = useState<'tous' | 'prives' | null>(null);
  const [ins, setIns] = useState<Inscription | null>(monInscription());
  useEffect(() => ecouterMarques(() => setIns(monInscription())), []);
  useEffect(() => {
    const ouvrirSur = (q: string | null) => {
      if (!q) return;
      setTchat(q === 'marques_tchat' ? 'prives' : 'tous');
      setOuvert(true);
    };
    // touchee avant que cette banniere soit chargee (demarrage a froid)...
    ouvrirSur(reprendreTouchee(['marques_tchat', 'marques_invit']));
    // ...ou pendant que le jeu tourne. Une sonnerie de la boite sans
    // notification touchee ne laisse rien a reprendre : elle n'ouvre rien.
    return surCourrier(() => ouvrirSur(reprendreTouchee(['marques_tchat', 'marques_invit'])));
  }, []);
  const { ref, vivant } = useVivant<HTMLButtonElement>();
  return (
    <motion.div {...MONTEE}>
      <motion.button ref={ref} onClick={() => setOuvert(true)} whileTap={{ scale: 0.98 }}
              className="relative w-full rounded-2xl border-2 border-primary/60 overflow-hidden flex items-center gap-3
                         px-3 py-2.5 text-left"
              style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.10), rgba(255,212,38,0.14))' }}>
        {/* les deux camps qui se poussent : la ligne de partage tangue */}
        <motion.div aria-hidden className="absolute inset-0 pointer-events-none"
          style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.10) 48%, rgba(255,212,38,0.16) 52%, rgba(255,212,38,0.16) 100%)' }}
          animate={vivant ? { x: ['-6%', '6%', '-6%'] } : { x: 0 }}
          transition={vivant ? { duration: 3.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }} />
        <Reflet vivant={vivant} />
        {/* le bord, qui respire */}
        <motion.div aria-hidden className="absolute inset-0 rounded-2xl border-2 border-primary pointer-events-none"
          animate={vivant ? { opacity: [0.2, 0.9, 0.2] } : { opacity: 0.5 }}
          transition={vivant ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }} />

        {/* les epees : un choc toutes les trois secondes */}
        <motion.span className="relative shrink-0"
          animate={vivant ? { rotate: [0, -16, 14, -6, 0, 0], scale: [1, 1.22, 1.1, 1.04, 1, 1] } : { rotate: 0, scale: 1 }}
          transition={vivant ? { duration: 3, times: [0, 0.06, 0.12, 0.18, 0.26, 1], repeat: Infinity, ease: 'easeOut' } : { duration: 0 }}>
          <Swords className="w-7 h-7 text-primary" aria-hidden />
          {vivant && (
            <motion.span aria-hidden className="absolute inset-0 rounded-full"
              style={{ boxShadow: '0 0 18px 6px rgba(255,212,38,0.7)' }}
              animate={{ opacity: [0, 1, 0, 0], scale: [0.4, 1.3, 1.6, 1.6] }}
              transition={{ duration: 3, times: [0, 0.07, 0.25, 1], repeat: Infinity, ease: 'easeOut' }} />
          )}
        </motion.span>

        <span className="relative flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 truncate">
            {fr ? 'Le duel · 100 · 200 · 400 m' : 'The duel · 100 · 200 · 400 m'}
          </span>
          <span className="font-black text-sm md:text-base leading-tight whitespace-nowrap">
            <motion.span className="inline-block" style={{ color: TEINTE.adidas }}
              animate={vivant ? { x: [0, -2, 0], textShadow: ['0 0 0px rgba(255,255,255,0)', `0 0 10px ${HALO.adidas}`, '0 0 0px rgba(255,255,255,0)'] } : {}}
              transition={vivant ? { duration: 3, times: [0, 0.08, 0.3], repeat: Infinity } : { duration: 0 }}>
              TEAM ADIDAS
            </motion.span>
            <motion.span className="inline-block text-foreground/60 mx-1"
              animate={vivant ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={vivant ? { duration: 3, times: [0, 0.07, 0.2], repeat: Infinity } : { duration: 0 }}>
              vs
            </motion.span>
            <motion.span className="inline-block" style={{ color: TEINTE.nike }}
              animate={vivant ? { x: [0, 2, 0], textShadow: ['0 0 0px rgba(255,212,38,0)', `0 0 10px ${HALO.nike}`, '0 0 0px rgba(255,212,38,0)'] } : {}}
              transition={vivant ? { duration: 3, times: [0, 0.08, 0.3], repeat: Infinity } : { duration: 0 }}>
              TEAM NIKE
            </motion.span>
          </span>
          <span className="text-[10px] md:text-xs text-foreground/65 leading-snug truncate">
            {ins
              ? (fr ? `Tu cours le ${NOM_EPREUVE[ins.epreuve]} pour Team ${NOM_CAMP[ins.camp]}`
                    : `You run the ${NOM_EPREUVE[ins.epreuve]} for Team ${NOM_CAMP[ins.camp]}`)
              : (fr ? 'Choisis ton camp et ton épreuve' : 'Pick your side and your event')}
          </span>
        </span>
        <motion.span className="relative shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest bg-white"
          animate={vivant ? BATTEMENT : { scale: 1 }}
          transition={vivant ? BATTEMENT_T : { duration: 0 }}>
          {ins ? (fr ? 'TABLEAU' : 'BOARD') : (fr ? 'CHOISIR' : 'PICK')}
        </motion.span>
      </motion.button>
      <AnimatePresence>
        {ouvert && <EcranMarques tchatAuDepart={tchat} sansIntro={retour}
                                 onClose={() => { setOuvert(false); setTchat(null); setRetour(false); }} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- l'ecran */

/** Le face-a-face du titre : chaque nom entre par son bord, le VS tombe entre les deux. */
function Titre({ reduit }: { reduit: boolean }) {
  const d = reduit ? { duration: 0 } : undefined;
  return (
    <h2 className="font-black font-display tracking-tight text-xl md:text-2xl leading-tight whitespace-nowrap">
      <motion.span className="inline-block" style={{ color: TEINTE.adidas }}
        initial={reduit ? false : { x: -60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={d || { ...RESSORT.glissement, delay: 0.05 }}>
        TEAM ADIDAS
      </motion.span>
      <motion.span className="inline-block text-foreground/50 mx-1.5"
        initial={reduit ? false : { scale: 2.4, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={d || { ...RESSORT.trophee, delay: 0.32 }}>
        vs
      </motion.span>
      <motion.span className="inline-block" style={{ color: TEINTE.nike }}
        initial={reduit ? false : { x: 60, opacity: 0 }} animate={{ x: 0, opacity: 1 }}
        transition={d || { ...RESSORT.glissement, delay: 0.15 }}>
        TEAM NIKE
      </motion.span>
    </h2>
  );
}

/**
 * Defier le fantome d'un coureur du duel : sa trace, son chrono, son nom, et
 * la cible dans les options du depart — engine.ts la relit a l'arrivee pour
 * que le serveur juge le duel. Rend faux si le fantome n'a pas pu venir.
 */
async function defierFantome(nom: string): Promise<boolean> {
  const f = await fetchFantome(nom);
  if (!f) return false;
  (SprinterApp as any).startOneShot([f.epreuve], {
    levelIdx: 4,
    ghosts: [f.trace],
    ghostSplits: [f.best_ms / 1000],
    ghostName: f.name,
    ghostTime: f.best_ms / 1000,
    etiquette: 'fantome',
    duelMarques: { cible: f.name, camp: f.camp },
  });
  return true;
}

export function EcranMarques({ onClose, tchatAuDepart = null, sansIntro = false }: {
  onClose: () => void; tchatAuDepart?: 'tous' | 'prives' | null; sansIntro?: boolean;
}) {
  useRetour(onClose);
  const fr = useFr();
  const reduit = useAnimationsReduites();
  // le face-a-face d'abord ; l'ecran entre ensuite, avec ses propres animations.
  // Pas de face-a-face quand on arrive par une notification du tchat, ni en
  // revenant d'une course partie d'ici.
  const [intro, setIntro] = useState(!reduit && !tchatAuDepart && !sansIntro);
  // le tchat, un tiroir en bas de l'ecran : deplie d'emblee quand on arrive par sa notification
  const [tchatDeplie, setTchatDeplie] = useState(!!tchatAuDepart);
  const { t, erreur, essai, relire } = useTableau();
  const [enRoute, setEnRoute] = useState<string | null>(null);
  const [changer, setChanger] = useState(false);
  const defier = async (nom: string) => {
    if (enRoute) return;
    setEnRoute(nom);
    const ok = await defierFantome(nom);
    setEnRoute(null);
    if (ok) { rouvrirAuRetour = true; onClose(); }
  };
  const moi = t?.moi || null;
  const [vueCamp, setVueCamp] = useState<Camp | null>(null);
  const [vueEpreuve, setVueEpreuve] = useState<Epreuve | null>(null);
  const camp: Camp = vueCamp || moi?.camp || 'adidas';
  const epreuve: Epreuve = vueEpreuve || moi?.epreuve || '100';

  const courir = (e: Epreuve) => {
    rouvrirAuRetour = true;
    onClose();
    (SprinterApp as any).startOneShot([e], { levelIdx: 4 });
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      <AnimatePresence>
        {intro && <FaceAFace fr={fr} onDone={() => setIntro(false)} />}
      </AnimatePresence>
      {!intro && (
      <div className="max-w-xl mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-4">

        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <Titre reduit={reduit} />
            <motion.span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide"
              initial={reduit ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
              {fr ? '100, 200 et 400 m · six jours · 32 places par équipe' : '100, 200 and 400 m · six days · 32 seats per team'}
              {t?.fin ? ` · ${fr ? 'fin le' : 'ends'} ${new Date(t.fin).toLocaleString(fr ? 'fr-FR' : 'en-GB',
                { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </motion.span>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors shrink-0">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {!t && !erreur && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          </p>
        )}
        {erreur && !t && (
          <div className="flex flex-col items-center gap-3 py-8">
            <p className="text-sm text-muted-foreground text-center">
              {fr ? 'Le tableau ne répond pas. Nouvel essai dans un instant…' : 'The board is not answering. Trying again in a moment…'}
            </p>
            <button onClick={relire} disabled={essai}
                    className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/80 border border-white/10 text-sm font-display hover:bg-white/10 transition-colors disabled:opacity-60">
              {essai
                ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                : <RotateCcw className="w-4 h-4" aria-hidden />}
              {fr ? 'Réessayer' : 'Try again'}
            </button>
          </div>
        )}

        {t && <Score t={t} fr={fr} reduit={reduit} />}

        <p className="w-full text-[10px] md:text-[11px] text-muted-foreground/85 text-center leading-snug px-2">
          {fr
            ? 'Tu choisis ton camp et ton épreuve. Ton meilleur chrono de la semaine compte. Sur chaque épreuve, les deux camps comptent autant de coureurs : s’il y a 14 Nike au 400 m, les 14 meilleurs adidas du 400 m comptent aussi. La plus petite somme gagne.'
            : 'Pick your side and your event. Your best time of the week counts. On each event both sides count the same number of runners: 14 Nike at 400 m means the 14 best adidas at 400 m count too. The lowest sum wins.'}
          {t?.bonus_ko && (fr
            ? ` Bats le fantôme d’un adversaire de ton épreuve : il est éliminé, et ton camp gagne ${secondes(t.bonus_ko['100'])} s au 100 m, ${secondes(t.bonus_ko['200'])} s au 200 m, ${secondes(t.bonus_ko['400'])} s au 400 m, tant qu’il ne s’est pas vengé.`
            : ` Beat a rival’s ghost on your event: they are knocked out and your side gains ${secondes(t.bonus_ko['100'])} s at 100 m, ${secondes(t.bonus_ko['200'])} s at 200 m, ${secondes(t.bonus_ko['400'])} s at 400 m, until they take revenge.`)}
        </p>

        {t && !moi && <ChoixDuCamp t={t} fr={fr} reduit={reduit} />}

        {t && moi && <MaLigne t={t} fr={fr} courir={courir} reduit={reduit}
                               defier={defier} enRoute={enRoute} changer={() => setChanger(true)} />}

        {t && moi && <Cibles t={t} fr={fr} reduit={reduit} defier={defier} enRoute={enRoute} />}

        {t && t.fil && t.fil.length > 0 && <FilBataille fil={t.fil} fr={fr} reduit={reduit} />}

        {t && (
          <>
            <div className="relative w-full grid grid-cols-2 gap-1 p-1 rounded-xl bg-card/60 border border-white/5">
              {CAMPS.map(c => (
                <button key={c} onClick={() => setVueCamp(c)}
                        className={`relative py-1.5 rounded-lg text-[11px] font-black tracking-widest transition-colors
                                    ${camp === c ? '' : 'hover:bg-white/5 text-foreground/60'}`}
                        style={camp === c ? { color: TEINTE[c] } : undefined}>
                  {camp === c && (
                    <motion.span layoutId="duel-onglet-camp" className="absolute inset-0 rounded-lg bg-white/10"
                      transition={reduit ? { duration: 0 } : RESSORT.panneau} />
                  )}
                  <span className="relative">TEAM {NOM_CAMP[c].toUpperCase()}</span>
                </button>
              ))}
            </div>
            <div className="w-full grid grid-cols-3 gap-1 -mt-2">
              {EPREUVES.map(e => (
                <button key={e} onClick={() => setVueEpreuve(e)}
                        className={`relative py-1 rounded-lg text-[11px] font-black tracking-widest transition-colors
                                    ${epreuve === e ? 'text-foreground' : 'text-foreground/50 hover:bg-white/5'}`}>
                  {epreuve === e && (
                    <motion.span layoutId="duel-onglet-epreuve" className="absolute inset-0 rounded-lg bg-white/10"
                      transition={reduit ? { duration: 0 } : RESSORT.panneau} />
                  )}
                  <span className="relative">{NOM_EPREUVE[e]}</span>
                </button>
              ))}
            </div>
            <Coureurs key={camp + epreuve} t={t} camp={camp} epreuve={epreuve} fr={fr} reduit={reduit}
                      defier={defier} enRoute={enRoute} />
          </>
        )}

        {t && moi && <Mention fr={fr} />}
      </div>
      )}
      <AnimatePresence>
        {changer && t && moi && <ChangerEpreuve t={t} fr={fr} reduit={reduit} onClose={() => setChanger(false)} />}
      </AnimatePresence>

      {/* le tchat du duel : un tiroir, replie en barre sous le tableau */}
      {!intro && t && (
        <TchatMarques fr={fr} ouvrirSur={tchatAuDepart || 'tous'} viserLeDernier={tchatAuDepart === 'prives'}
          moi={{ name: getSavedName() || '', inscrit: !!moi }}
          deplie={tchatDeplie} onDeplier={setTchatDeplie} />
      )}
    </motion.div>
  );
}

/** Un total qui defile, ou un tiret tant qu'aucune place ne compte. */
function Total({ ms, places, fr, reduit, className }: { ms: number; places: number; fr: boolean; reduit: boolean; className?: string }) {
  const v = useCompteur(ms, reduit);
  return <span className={className}>{places ? somme(Math.round(v), fr) : '—'}</span>;
}

/** Les deux totaux face a face, la corde, puis epreuve par epreuve. */
function Score({ t, fr, reduit }: { t: TableauMarques; fr: boolean; reduit: boolean }) {
  const [a, b] = CAMPS;
  const ecart = Math.abs(t.totaux[a] - t.totaux[b]);
  const { ref, vivant } = useVivant<HTMLDivElement>();
  // La corde : au centre a egalite, tiree vers le camp qui mene, d'autant
  // plus loin que l'ecart pese dans la somme (bornee pour rester lisible).
  const part = t.places_total && t.tete
    ? Math.min(0.42, (ecart / Math.max(1, (t.totaux[a] + t.totaux[b]) / 2)) * 4) * (t.tete === a ? -1 : 1)
    : 0;
  return (
    <div ref={ref} className="w-full flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {CAMPS.map((c, i) => {
          const devant = t.tete === c;
          return (
            <motion.div key={c}
              initial={reduit ? false : { opacity: 0, x: i ? 40 : -40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={reduit ? { duration: 0 } : { ...RESSORT.glissement, delay: 0.1 + 0.08 * i }}
              className={`relative overflow-hidden rounded-xl border px-3 py-3 flex flex-col items-center gap-0.5
                          ${devant ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-card/60'}`}>
              {devant && vivant && (
                <motion.div aria-hidden className="absolute inset-0 rounded-xl pointer-events-none"
                  style={{ boxShadow: 'inset 0 0 24px rgba(255,212,38,0.45)' }}
                  animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }} />
              )}
              <span className="relative text-[10px] font-black tracking-[0.18em]" style={{ color: TEINTE[c] }}>
                TEAM {NOM_CAMP[c].toUpperCase()}
              </span>
              <Total ms={t.totaux[c]} places={t.places_total} fr={fr} reduit={reduit}
                className="relative font-black tabular-nums text-base md:text-lg" />
              <span className="relative text-[10px] text-muted-foreground/80">
                {fr ? `${t.inscrits[c]} inscrit${t.inscrits[c] > 1 ? 's' : ''}` : `${t.inscrits[c]} signed up`}
              </span>
              {t.ko && (
                <motion.span className="relative flex items-center gap-1 text-[10px] font-black tracking-widest"
                  style={{ color: TEINTE[c] }}
                  initial={reduit ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={reduit ? { duration: 0 } : { delay: 0.7 + 0.1 * i }}>
                  <Swords className="w-3 h-3" aria-hidden />
                  {t.ko[c]} K.O.{t.bonus && t.bonus[c] ? ` · −${secondes(t.bonus[c])} s` : ''}
                </motion.span>
              )}
              {devant && ecart > 0 && (
                <motion.span className="relative mt-1 text-[10px] font-black tracking-widest text-primary"
                  initial={reduit ? false : { scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  transition={reduit ? { duration: 0 } : { ...RESSORT.trophee, delay: 0.9 }}>
                  {fr ? `EN TÊTE · ${secondes(ecart)} s` : `LEADING · ${secondes(ecart)} s`}
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* la corde : chaque camp tire de son cote ; le noeud dit qui mene */}
      <div className="relative h-3 mx-2" aria-hidden>
        <div className="absolute inset-y-[5px] left-0 right-1/2 rounded-l-full" style={{ background: 'linear-gradient(90deg, rgba(255,255,255,0.05), rgba(255,255,255,0.5))' }} />
        <div className="absolute inset-y-[5px] left-1/2 right-0 rounded-r-full" style={{ background: 'linear-gradient(90deg, rgba(255,212,38,0.6), rgba(255,212,38,0.05))' }} />
        <div className="absolute top-0 bottom-0 left-1/2 w-px bg-white/30" />
        <motion.div className="absolute top-0 w-3 h-3 -ml-1.5 rounded-full bg-primary"
          style={{ boxShadow: '0 0 12px rgba(255,212,38,0.9)' }}
          initial={reduit ? false : { left: '50%', x: 0 }}
          animate={vivant && !t.places_total
            ? { left: '50%', x: [-8, 8, -8] }
            : { left: `${50 + part * 100}%`, x: 0 }}
          transition={vivant && !t.places_total
            ? { duration: 1.8, repeat: Infinity, ease: 'easeInOut' }
            : (reduit ? { duration: 0 } : { ...RESSORT.jauge, delay: 0.6 })} />
      </div>

      <div className="rounded-xl border border-white/10 bg-card/40 divide-y divide-white/5 overflow-hidden">
        {EPREUVES.map((e, i) => {
          const k = t.epreuves[e];
          const [ca, cb] = CAMPS.map(c => k.camps[c]);
          const attente = CAMPS.find(c => manque(t, c, e) > 0);
          return (
            <motion.div key={e} className="px-3 py-2 flex flex-col gap-0.5"
              initial={reduit ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              transition={reduit ? { duration: 0 } : { duration: 0.4, ease: COURBE.sortie as any, delay: 0.35 + 0.09 * i }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black tracking-widest w-14">{NOM_EPREUVE[e]}</span>
                <span className="text-[10px] text-muted-foreground">
                  {k.places
                    ? (fr ? `${k.places} contre ${k.places}` : `${k.places} vs ${k.places}`)
                    : (fr ? 'aucune place encore' : 'no seat yet')}
                </span>
                <span className="flex gap-2 tabular-nums text-[11px] font-black">
                  <Total ms={ca.somme_ms} places={k.places} fr={fr} reduit={reduit} className="" />
                  <span style={{ color: TEINTE[b] }}>
                    <Total ms={cb.somme_ms} places={k.places} fr={fr} reduit={reduit} />
                  </span>
                </span>
              </div>
              {attente && (
                <span className="flex items-start gap-1.5 text-[10px] text-primary/90 leading-snug">
                  <motion.span aria-hidden className="mt-[3px] w-1.5 h-1.5 shrink-0 rounded-full bg-primary"
                    animate={vivant ? { scale: [1, 1.8, 1], opacity: [1, 0.4, 1] } : {}}
                    transition={vivant ? { duration: 1.2, repeat: Infinity } : { duration: 0 }} />
                  {fr
                    ? `${manque(t, attente, e)} place${manque(t, attente, e) > 1 ? 's' : ''} à prendre pour Team ${NOM_CAMP[attente]} : le prochain qui court le ${NOM_EPREUVE[e]} compte.`
                    : `${manque(t, attente, e)} seat${manque(t, attente, e) > 1 ? 's' : ''} open for Team ${NOM_CAMP[attente]}: the next ${NOM_EPREUVE[e]} runner counts.`}
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

/** Ma ligne : mon camp, mon epreuve, ma place, et le bouton pour courir. */
function MaLigne({ t, fr, courir, reduit, defier, enRoute, changer }: {
  t: TableauMarques; fr: boolean; courir: (e: Epreuve) => void; reduit: boolean;
  defier: (nom: string) => void; enRoute: string | null; changer: () => void;
}) {
  const moi = t.moi!;
  const ep = NOM_EPREUVE[moi.epreuve];
  const { ref, vivant } = useVivant<HTMLDivElement>();
  const etat = moi.best_ms == null
    ? (fr ? `Aucun ${ep} encore cette semaine` : `No ${ep} yet this week`)
    : moi.selectionne
      ? (fr ? `${moi.rang}ᵉ du camp au ${ep} · tu comptes` : `#${moi.rang} on your side at ${ep} · you count`)
      : moi.attend_adversaire
        ? (fr ? `${moi.rang}ᵉ · tu compteras dès qu’un adversaire de plus court le ${ep}`
              : `#${moi.rang} · you count as soon as one more rival runs the ${ep}`)
        : (fr ? `${moi.rang}ᵉ · il faut ${secondes(moi.seuil_ms ?? 0)} pour compter`
              : `#${moi.rang} · ${secondes(moi.seuil_ms ?? 0)} to count`);
  const bourreaux = moi.elimine_par || [];
  return (
    <div className="w-full flex flex-col gap-1.5">
    <motion.div ref={ref}
      initial={reduit ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
      transition={reduit ? { duration: 0 } : { ...RESSORT.trophee, delay: 0.2 }}
      className="relative overflow-hidden w-full rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
      style={{ borderColor: `${TEINTE[moi.camp]}66`, background: `${TEINTE[moi.camp]}14` }}>
      <Reflet vivant={vivant} periode={5} delai={1.4} />
      <div className="relative flex flex-col min-w-0 leading-tight">
        <span className="text-[10px] tracking-[0.18em] uppercase text-foreground/70">
          {fr ? `Ton camp · ${ep}` : `Your side · ${ep}`}
        </span>
        <span className="font-black text-lg" style={{ color: TEINTE[moi.camp] }}>
          TEAM {NOM_CAMP[moi.camp].toUpperCase()}
        </span>
        <span className="text-[11px] text-muted-foreground">{etat}</span>
        {!!moi.ko && (
          <span className="flex items-center gap-1 text-[11px] font-black text-primary">
            <Swords className="w-3 h-3" aria-hidden />
            {fr ? `Tu tiens ${moi.ko} duel${moi.ko > 1 ? 's' : ''}` : `You hold ${moi.ko} duel${moi.ko > 1 ? 's' : ''}`}
          </span>
        )}
        <button onClick={changer}
                className="mt-1 self-start flex items-center gap-1 text-[10px] font-bold tracking-wider text-foreground/60 underline underline-offset-2 hover:text-foreground">
          <ArrowLeftRight className="w-3 h-3" aria-hidden />
          {fr ? 'Changer d’épreuve' : 'Switch event'}
        </button>
      </div>
      <div className="relative flex flex-col items-end gap-1.5 shrink-0">
        {moi.best_ms != null && (
          <span className="font-black tabular-nums text-lg" style={{ color: TEINTE[moi.camp] }}>
            {secondes(moi.best_ms)} s
          </span>
        )}
        <motion.button onClick={() => courir(moi.epreuve)} whileTap={{ scale: 0.95 }}
                animate={vivant ? BATTEMENT : { scale: 1 }}
                transition={vivant ? BATTEMENT_T : { duration: 0 }}
                className="px-3 py-1.5 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest">
          {fr ? `COURIR LE ${ep.toUpperCase()}` : `RUN THE ${ep.toUpperCase()}`}
        </motion.button>
      </div>
    </motion.div>

    {/* eliminé : qui me tient, et la revanche a portee de doigt */}
    {bourreaux.map((b, i) => (
      <motion.div key={b}
        initial={reduit ? false : { opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
        transition={reduit ? { duration: 0 } : { ...RESSORT.glissement, delay: 0.35 + 0.08 * i }}
        className="relative overflow-hidden w-full rounded-xl border border-red-500/50 bg-red-500/10 px-3 py-2 flex items-center gap-2">
        <motion.span aria-hidden animate={vivant ? { rotate: [0, -12, 12, 0] } : {}}
          transition={vivant ? { duration: 0.6, repeat: Infinity, repeatDelay: 1.8 } : { duration: 0 }}>
          <Skull className="w-4 h-4 text-red-300" />
        </motion.span>
        <span className="flex-1 min-w-0 text-[11px] leading-snug text-red-100">
          {fr ? <>Éliminé par <b>{b}</b> : il a battu ton fantôme.</> : <>Knocked out by <b>{b}</b>: they beat your ghost.</>}
        </span>
        <motion.button onClick={() => defier(b)} disabled={!!enRoute} whileTap={{ scale: 0.95 }}
          animate={vivant && !enRoute ? BATTEMENT : { scale: 1 }}
          transition={vivant && !enRoute ? BATTEMENT_T : { duration: 0 }}
          className="shrink-0 px-2.5 py-1.5 rounded-lg bg-red-500 text-white text-[10px] font-black tracking-widest flex items-center gap-1 disabled:opacity-50">
          {enRoute === b ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
          {fr ? 'VENGE-TOI' : 'REVENGE'}
        </motion.button>
      </motion.div>
    ))}
    </div>
  );
}

/**
 * TES CIBLES : les adversaires de ton epreuve les plus proches de ton chrono
 * (ceux que tu peux battre, et ceux qui te devancent de peu), puis le
 * coequipier juste devant toi. Ceux dont tu tiens deja le duel n'y sont pas :
 * on ne gagne rien a les rebattre.
 */
function Cibles({ t, fr, reduit, defier, enRoute }: {
  t: TableauMarques; fr: boolean; reduit: boolean; defier: (nom: string) => void; enRoute: string | null;
}) {
  const moi = t.moi!;
  const autre = CAMPS.find(c => c !== moi.camp)!;
  const moiNom = getSavedName().trim().toLowerCase();
  const tenus = new Set((moi.tenus || []).map(n => n.toLowerCase()));
  const ref = moi.best_ms ?? Infinity;
  const proche = (ms: number) => (ref === Infinity ? -ms : -Math.abs(ms - ref));
  const adversaires = t.epreuves[moi.epreuve].camps[autre].coureurs
    .filter(c => !tenus.has(c.name.toLowerCase()))
    .sort((a, b) => proche(b.ms) - proche(a.ms))
    .slice(0, 3);
  const miens = t.epreuves[moi.epreuve].camps[moi.camp].coureurs
    .filter(c => c.name.trim().toLowerCase() !== moiNom);
  const devant = miens.filter(c => c.ms < ref).pop() || (moi.best_ms == null ? miens[miens.length - 1] : undefined);
  const lignes = [...adversaires.map(c => ({ ...c, camp: autre })), ...(devant ? [{ ...devant, camp: moi.camp }] : [])];
  const { ref: vue, vivant } = useVivant<HTMLDivElement>();
  if (!lignes.length) {
    return (
      <p className="w-full text-center text-[11px] text-muted-foreground px-4">
        {(moi.tenus || []).length
          ? (fr ? 'Tu tiens le duel contre chaque adversaire de ton épreuve. Garde ta place.' : 'You hold the duel against every rival on your event. Keep your seat.')
          : (fr ? 'Aucun fantôme à défier encore sur ton épreuve.' : 'No ghost to challenge on your event yet.')}
      </p>
    );
  }
  return (
    <div ref={vue} className="w-full flex flex-col gap-1">
      <span className="flex items-center justify-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-foreground/80">
        <Crosshair className="w-3 h-3 text-primary" aria-hidden />
        {fr ? 'TES CIBLES' : 'YOUR TARGETS'}
      </span>
      {lignes.map((c, i) => {
        const adverse = c.camp !== moi.camp;
        const battable = moi.best_ms != null && moi.best_ms < c.ms;
        return (
          <motion.div key={c.name}
            initial={reduit ? false : { opacity: 0, x: adverse ? 24 : -24 }} animate={{ opacity: 1, x: 0 }}
            transition={reduit ? { duration: 0 } : { ...RESSORT.glissement, delay: 0.3 + 0.07 * i }}
            className="relative overflow-hidden flex items-center gap-2 px-3 py-2 rounded-xl border"
            style={{ borderColor: `${TEINTE[c.camp]}40`, background: `${TEINTE[c.camp]}0D` }}>
            <Ghost className="w-4 h-4 shrink-0" style={{ color: TEINTE[c.camp] }} aria-hidden />
            <span className="flex-1 min-w-0 flex flex-col leading-tight">
              <span className="truncate text-sm font-bold">{c.name}</span>
              <span className="text-[10px] text-muted-foreground truncate">
                {adverse
                  ? (c.elimine_par
                      ? (fr ? `Team ${NOM_CAMP[c.camp]} · déjà K.O. par ${c.elimine_par}` : `Team ${NOM_CAMP[c.camp]} · already KO’d by ${c.elimine_par}`)
                      : battable
                        ? (fr ? `Team ${NOM_CAMP[c.camp]} · ton record le bat` : `Team ${NOM_CAMP[c.camp]} · your best beats it`)
                        : (fr ? `Team ${NOM_CAMP[c.camp]} · K.O. = −${secondes(t.bonus_ko?.[moi.epreuve] ?? 0)} s` : `Team ${NOM_CAMP[c.camp]} · KO = −${secondes(t.bonus_ko?.[moi.epreuve] ?? 0)} s`))
                  : (fr ? 'Ton camp · juste devant toi' : 'Your side · just ahead of you')}
              </span>
            </span>
            <span className="font-black tabular-nums text-sm" style={{ color: TEINTE[c.camp] }}>{secondes(c.ms)}</span>
            <motion.button onClick={() => defier(c.name)} disabled={!!enRoute} whileTap={{ scale: 0.94 }}
              animate={vivant && adverse && i === 0 && !enRoute ? BATTEMENT : { scale: 1 }}
              transition={vivant && adverse && i === 0 && !enRoute ? BATTEMENT_T : { duration: 0 }}
              className={`shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-black tracking-widest flex items-center gap-1 disabled:opacity-50
                          ${adverse ? 'bg-primary text-black' : 'bg-white/10 text-foreground border border-white/15'}`}>
              {enRoute === c.name ? <Loader2 className="w-3 h-3 animate-spin" /> : <Swords className="w-3 h-3" />}
              {fr ? 'DÉFIER' : 'FIGHT'}
            </motion.button>
          </motion.div>
        );
      })}
    </div>
  );
}

/** Il y a combien de temps, en mots courts. */
function ilYA(quand: number, fr: boolean): string {
  const s = Math.max(0, (Date.now() - quand) / 1000);
  if (s < 60) return fr ? 'à l’instant' : 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return fr ? `il y a ${m} min` : `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return fr ? `il y a ${h} h` : `${h} h ago`;
  const j = Math.floor(h / 24);
  return fr ? `il y a ${j} j` : `${j} d ago`;
}

/** LE FIL DE LA BATAILLE : qui entre, qui change, qui elimine qui, qui se venge. */
function FilBataille({ fil, fr, reduit }: { fil: LigneFil[]; fr: boolean; reduit: boolean }) {
  const [tout, setTout] = useState(false);
  const lignes = tout ? fil : fil.slice(0, 6);
  const texte = (l: LigneFil): React.ReactNode => {
    const ep = l.epreuve ? NOM_EPREUVE[l.epreuve] : '';
    const a = <b style={{ color: TEINTE[l.camp] }}>{l.a}</b>;
    const b = <b>{l.b}</b>;
    switch (l.genre) {
      case 'ko': return fr ? <>{a} élimine {b} au {ep}{l.ms ? ` · ${secondes(l.ms)}` : ''}</> : <>{a} knocks out {b} at {ep}{l.ms ? ` · ${secondes(l.ms)}` : ''}</>;
      case 'revanche': return fr ? <>{a} se venge de {b} au {ep}</> : <>{a} takes revenge on {b} at {ep}</>;
      case 'coequipier': return fr ? <>{a} passe devant le fantôme de {b}, son coéquipier</> : <>{a} beats teammate {b}’s ghost</>;
      case 'change': return fr ? <>{a} quitte le {l.b ? NOM_EPREUVE[l.b as Epreuve] : '?'} pour le {ep}</> : <>{a} leaves the {l.b ? NOM_EPREUVE[l.b as Epreuve] : '?'} for the {ep}</>;
      default: return fr ? <>{a} rejoint Team {NOM_CAMP[l.camp]} au {ep}</> : <>{a} joins Team {NOM_CAMP[l.camp]} at {ep}</>;
    }
  };
  const icone = (l: LigneFil) => {
    const c = { className: 'w-3.5 h-3.5 shrink-0', style: { color: TEINTE[l.camp] } };
    switch (l.genre) {
      case 'ko': return <Swords {...c} />;
      case 'revanche': return <RotateCcw {...c} />;
      case 'coequipier': return <Ghost {...c} />;
      case 'change': return <ArrowLeftRight {...c} />;
      default: return <UserPlus {...c} />;
    }
  };
  return (
    <div className="w-full flex flex-col gap-1">
      <span className="flex items-center justify-center gap-1.5 text-[10px] font-black tracking-[0.2em] text-foreground/80">
        <motion.span aria-hidden className="w-1.5 h-1.5 rounded-full bg-red-500"
          animate={reduit ? {} : { opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
        {fr ? 'LE FIL DE LA BATAILLE' : 'BATTLE FEED'}
      </span>
      <div className="rounded-xl border border-white/10 bg-card/40 divide-y divide-white/5 overflow-hidden">
        <AnimatePresence initial={!reduit}>
          {lignes.map((l, i) => (
            <motion.div key={`${l.quand}-${l.genre}-${l.a}`} layout={!reduit}
              initial={reduit ? false : { opacity: 0, x: l.camp === 'adidas' ? -16 : 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={reduit ? { duration: 0 } : { duration: 0.3, delay: Math.min(i, 8) * 0.04 }}
              className={`flex items-center gap-2 px-3 py-1.5 ${l.genre === 'ko' || l.genre === 'revanche' ? 'bg-white/[0.03]' : ''}`}>
              {icone(l)}
              <span className="flex-1 min-w-0 text-[11px] leading-snug truncate">{texte(l)}</span>
              <span className="shrink-0 text-[9px] text-muted-foreground">{ilYA(l.quand, fr)}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      {fil.length > 6 && (
        <button onClick={() => setTout(x => !x)} className="self-center text-[10px] text-foreground/60 underline underline-offset-2">
          {tout ? (fr ? 'Moins' : 'Less') : (fr ? `Tout le fil (${fil.length})` : `Whole feed (${fil.length})`)}
        </button>
      )}
    </div>
  );
}

/**
 * CHANGER D'EPREUVE. Le camp reste ; le chrono et les duels de l'epreuve
 * quittee disparaissent — l'ecran le dit, chiffres a l'appui, avant de
 * confirmer.
 */
function ChangerEpreuve({ t, fr, reduit, onClose }: { t: TableauMarques; fr: boolean; reduit: boolean; onClose: () => void }) {
  const moi = t.moi!;
  const [e, setE] = useState<Epreuve | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState(false);
  const perte: string[] = [];
  if (moi.best_ms != null) perte.push(fr ? `ton ${secondes(moi.best_ms)} s au ${NOM_EPREUVE[moi.epreuve]}` : `your ${secondes(moi.best_ms)} s at ${NOM_EPREUVE[moi.epreuve]}`);
  if (moi.ko) perte.push(fr ? `tes ${moi.ko} duel${moi.ko > 1 ? 's' : ''} tenu${moi.ko > 1 ? 's' : ''}` : `your ${moi.ko} held duel${moi.ko > 1 ? 's' : ''}`);
  const confirmer = async () => {
    if (!e) return;
    setEnvoi(true); setRefus(false);
    const r = await changerEpreuve(e);
    setEnvoi(false);
    if ('refus' in r) setRefus(true); else onClose();
  };
  return (
    <motion.div {...VOILE} className="fixed inset-0 z-[59] bg-black/85 flex items-center justify-center px-5" onClick={() => !envoi && onClose()}>
      <motion.div {...PANNEAU} onClick={ev => ev.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl border-2 p-5 flex flex-col items-center gap-3 bg-card"
        style={{ borderColor: `${TEINTE[moi.camp]}B0` }}>
        <span className="text-[10px] tracking-[0.2em] text-foreground/70">
          {fr ? `TEAM ${NOM_CAMP[moi.camp].toUpperCase()} · CHANGER D’ÉPREUVE` : `TEAM ${NOM_CAMP[moi.camp].toUpperCase()} · SWITCH EVENT`}
        </span>
        <div className="w-full flex flex-col gap-1.5">
          {EPREUVES.map((x, i) => {
            const actuelle = x === moi.epreuve;
            const m = manque(t, moi.camp, x);
            return (
              <motion.button key={x} disabled={actuelle} onClick={() => setE(x)}
                initial={reduit ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                transition={reduit ? { duration: 0 } : { duration: 0.3, delay: 0.1 + 0.07 * i }}
                className={`w-full rounded-xl border px-3 py-2 flex items-center gap-3 text-left transition-colors disabled:opacity-40
                            ${e === x ? 'border-primary bg-primary/15' : 'border-white/10 hover:bg-white/5'}`}>
                <span className="font-black text-lg w-16 shrink-0">{NOM_EPREUVE[x]}</span>
                <span className={`text-[11px] leading-snug ${m > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                  {actuelle ? (fr ? 'ton épreuve actuelle' : 'your current event')
                    : m > 0 ? (fr ? `${m} place${m > 1 ? 's' : ''} libre${m > 1 ? 's' : ''} pour ton camp` : `${m} open seat${m > 1 ? 's' : ''} for your side`)
                    : (fr ? `${t.epreuves[x].camps[moi.camp].coureurs.length} coureur(s) de ton camp` : `${t.epreuves[x].camps[moi.camp].coureurs.length} runner(s) on your side`)}
                </span>
              </motion.button>
            );
          })}
        </div>
        <p className="text-[11px] text-center leading-snug text-red-200">
          {perte.length
            ? (fr ? `Tu perds ${perte.join(' et ')}. Ils disparaissent du tableau.` : `You lose ${perte.join(' and ')}. They leave the board.`)
            : (fr ? 'Tu n’as encore rien couru sur ton épreuve : tu ne perds rien.' : 'You have not run your event yet: you lose nothing.')}
        </p>
        {refus && <p className="text-[12px] text-center text-red-300">{fr ? 'Pas de réseau. Réessaie.' : 'No network. Try again.'}</p>}
        <div className="w-full grid grid-cols-2 gap-2 pt-1">
          <button onClick={onClose} disabled={envoi} className="py-2 rounded-lg border border-white/15 text-[11px] font-black tracking-widest">
            {fr ? 'ANNULER' : 'CANCEL'}
          </button>
          <button onClick={confirmer} disabled={envoi || !e}
            className="py-2 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest flex items-center justify-center gap-1.5 disabled:opacity-40">
            {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ArrowLeftRight className="w-3.5 h-3.5" />}
            {fr ? 'CHANGER' : 'SWITCH'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/** Les coureurs d'un camp sur une epreuve : ceux qui comptent, puis les autres. */
function Coureurs({ t, camp, epreuve, fr, reduit, defier, enRoute }: {
  t: TableauMarques; camp: Camp; epreuve: Epreuve; fr: boolean; reduit: boolean;
  defier: (nom: string) => void; enRoute: string | null;
}) {
  const k = t.epreuves[epreuve];
  // on ne defie que sur son epreuve : c'est la que la bataille compte
  const peutDefier = !!t.moi && t.moi.epreuve === epreuve;
  const liste = k.camps[camp].coureurs;
  const moiNom = getSavedName().trim().toLowerCase();
  if (!liste.length) {
    return (
      <motion.p className="text-sm text-muted-foreground py-6 text-center px-6"
        initial={reduit ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {fr ? `Personne n’a encore couru le ${NOM_EPREUVE[epreuve]} pour ce camp.`
            : `Nobody has run the ${NOM_EPREUVE[epreuve]} for this side yet.`}
      </motion.p>
    );
  }
  return (
    <div className="w-full flex flex-col gap-1">
      {liste.map((r, i) => {
        const moi = r.name.trim().toLowerCase() === moiNom;
        const compte = i < k.places;
        return (
          <React.Fragment key={r.name + i}>
            {i === k.places && (
              <span className="text-[9px] tracking-[0.2em] text-muted-foreground text-center pt-1">
                {fr ? 'NE COMPTENT PAS ENCORE' : 'NOT COUNTING YET'}
              </span>
            )}
            <motion.div
              initial={reduit ? false : { opacity: 0, x: camp === 'adidas' ? -18 : 18 }}
              animate={{ opacity: compte ? 1 : 0.5, x: 0 }}
              transition={reduit ? { duration: 0 } : { duration: 0.35, ease: COURBE.sortie as any, delay: Math.min(i, 12) * 0.04 }}
              className={`flex items-center gap-3 px-3 py-1.5 rounded-lg
                          ${moi ? 'bg-primary/15 border border-primary/40' : 'bg-card/40'}`}>
              <span className="w-6 text-right text-[11px] font-black tabular-nums text-foreground/60">{i + 1}</span>
              <span className="flex-1 min-w-0 flex flex-col leading-tight">
                <span className="truncate text-sm font-bold">{r.name}</span>
                {r.elimine_par && (
                  <span className="flex items-center gap-1 text-[9px] text-red-300 truncate">
                    <Skull className="w-2.5 h-2.5 shrink-0" aria-hidden />
                    {fr ? `K.O. par ${r.elimine_par}` : `KO’d by ${r.elimine_par}`}
                  </span>
                )}
              </span>
              {!!r.ko && (
                <span className="flex items-center gap-0.5 text-[10px] font-black text-primary" title={fr ? 'duels tenus' : 'duels held'}>
                  <Swords className="w-3 h-3" aria-hidden />{r.ko}
                </span>
              )}
              <span className="font-black tabular-nums text-sm" style={{ color: TEINTE[camp] }}>{secondes(r.ms)}</span>
              {peutDefier && !moi && (
                <button onClick={() => defier(r.name)} disabled={!!enRoute}
                  aria-label={fr ? `Défier le fantôme de ${r.name}` : `Challenge ${r.name}’s ghost`}
                  className={`shrink-0 p-1.5 rounded-lg disabled:opacity-50 ${camp === t.moi!.camp ? 'bg-white/10' : 'bg-primary text-black'}`}>
                  {enRoute === r.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />}
                </button>
              )}
            </motion.div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Le choix, en trois gestes : un camp, une epreuve, la confirmation. Definitif. */
function ChoixDuCamp({ t, fr, reduit }: { t: TableauMarques; fr: boolean; reduit: boolean }) {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [epreuve, setEpreuve] = useState<Epreuve | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<ChoixRefuse | null>(null);
  const nom = getSavedName();
  const { ref, vivant } = useVivant<HTMLDivElement>();

  const fermer = () => { if (!envoi) { setCamp(null); setEpreuve(null); setRefus(null); } };
  const confirmer = async () => {
    if (!camp || !epreuve) return;
    setEnvoi(true); setRefus(null);
    const r = await choisirCamp(camp, epreuve);
    setEnvoi(false);
    if ('refus' in r && r.refus !== 'deja') setRefus(r.refus);
    else { setCamp(null); setEpreuve(null); }
  };

  const MOTS_REFUS: Record<ChoixRefuse, [string, string]> = {
    'nom': ['Choisis d’abord ton nom de coureur, sur l’accueil.', 'Pick your runner name first, on the home screen.'],
    'nom-reserve': ['Ce nom est réservé par un autre appareil.', 'This name is reserved by another device.'],
    'deja': ['', ''],
    'reseau': ['Pas de réseau. Réessaie.', 'No network. Try again.'],
  };

  /** Ce que vaut chaque epreuve pour ce camp, dit au moment du choix. */
  const atout = (c: Camp, e: Epreuve): string => {
    const m = manque(t, c, e);
    if (m > 0) return fr ? `${m} place${m > 1 ? 's' : ''} libre${m > 1 ? 's' : ''} : ta première course compte`
                         : `${m} open seat${m > 1 ? 's' : ''}: your first run counts`;
    const n = t.epreuves[e].camps[c].coureurs.length;
    if (!n) return fr ? 'personne encore : ouvre l’épreuve pour ton camp' : 'nobody yet: open the event for your side';
    return fr ? `${n} coureur${n > 1 ? 's' : ''} déjà : place au chrono` : `${n} runner${n > 1 ? 's' : ''} already: earn your seat`;
  };

  const actif = vivant && !!nom;
  return (
    <div ref={ref} className="w-full flex flex-col gap-2">
      <span className="text-center text-[11px] font-black tracking-[0.2em] text-foreground/80">
        {fr ? 'QUEL CAMP DÉFENDS-TU ?' : 'WHICH SIDE DO YOU RUN FOR?'}
      </span>
      {!nom && (
        <p className="text-center text-[11px] text-muted-foreground">{fr ? MOTS_REFUS.nom[0] : MOTS_REFUS.nom[1]}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {CAMPS.map((c, i) => (
          <motion.button key={c} disabled={!nom} onClick={() => setCamp(c)}
                  initial={reduit ? false : { opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                  transition={reduit ? { duration: 0 } : { ...RESSORT.glissement, delay: 0.45 + 0.1 * i }}
                  whileHover={nom ? { scale: 1.03 } : undefined} whileTap={nom ? { scale: 0.96 } : undefined}
                  className="relative overflow-hidden rounded-xl border-2 py-4 flex flex-col items-center gap-1
                             disabled:opacity-40"
                  style={{ borderColor: `${TEINTE[c]}99`, background: `${TEINTE[c]}10` }}>
            {/* les deux appellent tour a tour : l'un s'allume, puis l'autre */}
            {actif && (
              <motion.div aria-hidden className="absolute inset-0 rounded-xl pointer-events-none"
                style={{ boxShadow: `inset 0 0 28px ${HALO[c]}` }}
                animate={{ opacity: [0, 0.9, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 1.6, delay: i * 1.6, ease: 'easeInOut' }} />
            )}
            <Reflet vivant={actif} periode={3.2} delai={0.8 + i * 1.6} />
            <span className="relative text-[10px] tracking-[0.2em] text-foreground/70">TEAM</span>
            <span className="relative font-black text-2xl" style={{ color: TEINTE[c] }}>{NOM_CAMP[c].toUpperCase()}</span>
          </motion.button>
        ))}
      </div>
      <Mention fr={fr} />

      <AnimatePresence>
        {camp && (
          <motion.div {...VOILE} className="fixed inset-0 z-[59] bg-black/85 flex items-center justify-center px-5"
                      onClick={fermer}>
            <motion.div {...PANNEAU} onClick={e => e.stopPropagation()}
                        className="relative overflow-hidden w-full max-w-md rounded-2xl border-2 p-5 flex flex-col items-center gap-3 bg-card"
                        style={{ borderColor: `${TEINTE[camp]}B0` }}>
              {/* l'eclat du choix, une fois */}
              {!reduit && (
                <motion.div aria-hidden className="absolute inset-0 pointer-events-none"
                  style={{ background: `radial-gradient(circle at 50% 18%, ${HALO[camp]}, transparent 60%)` }}
                  initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 1.2, ease: 'easeOut' }} />
              )}
              <span className="relative text-[10px] tracking-[0.2em] text-foreground/70">
                {fr ? 'TU DÉFENDS' : 'YOU RUN FOR'}
              </span>
              <motion.span className="relative font-black text-3xl" style={{ color: TEINTE[camp] }}
                initial={reduit ? false : { scale: 1.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                transition={reduit ? { duration: 0 } : { ...RESSORT.trophee, delay: 0.1 }}>
                TEAM {NOM_CAMP[camp].toUpperCase()}
              </motion.span>
              <span className="relative text-[10px] tracking-[0.2em] text-foreground/70 pt-1">
                {fr ? 'SUR QUELLE ÉPREUVE ?' : 'ON WHICH EVENT?'}
              </span>
              <div className="relative w-full flex flex-col gap-1.5">
                {EPREUVES.map((e, i) => (
                  <motion.button key={e} onClick={() => setEpreuve(e)}
                          initial={reduit ? false : { opacity: 0, x: -24 }} animate={{ opacity: 1, x: 0 }}
                          transition={reduit ? { duration: 0 } : { duration: 0.35, ease: COURBE.sortie as any, delay: 0.25 + 0.08 * i }}
                          whileTap={{ scale: 0.98 }}
                          className={`w-full rounded-xl border px-3 py-2 flex items-center gap-3 text-left transition-colors
                                      ${epreuve === e ? 'border-primary bg-primary/15' : 'border-white/10 hover:bg-white/5'}`}>
                    <motion.span className="font-black text-lg w-16 shrink-0"
                      animate={epreuve === e && !reduit ? { scale: [1, 1.15, 1] } : { scale: 1 }}
                      transition={{ duration: 0.35 }}>
                      {NOM_EPREUVE[e]}
                    </motion.span>
                    <span className={`text-[11px] leading-snug ${manque(t, camp, e) > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {atout(camp, e)}
                    </span>
                  </motion.button>
                ))}
              </div>
              <p className="relative text-[11px] text-center text-muted-foreground leading-snug">
                {fr ? 'C’est définitif jusqu’à la fin du duel. Seule cette épreuve comptera pour ton camp.'
                    : 'This is final until the duel ends. Only this event will count for your side.'}
              </p>
              {refus && (
                <p className="relative text-[12px] text-center text-red-300">{fr ? MOTS_REFUS[refus][0] : MOTS_REFUS[refus][1]}</p>
              )}
              <div className="relative w-full grid grid-cols-2 gap-2 pt-1">
                <button onClick={fermer} disabled={envoi}
                        className="py-2 rounded-lg border border-white/15 text-[11px] font-black tracking-widest">
                  {fr ? 'ANNULER' : 'CANCEL'}
                </button>
                <motion.button onClick={confirmer} disabled={envoi || !epreuve}
                        animate={epreuve && !reduit && !envoi ? BATTEMENT : { scale: 1 }}
                        transition={epreuve && !reduit && !envoi ? BATTEMENT_T : { duration: 0 }}
                        className="py-2 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest
                                   flex items-center justify-center gap-1.5 disabled:opacity-40">
                  {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {fr ? 'CONFIRMER' : 'CONFIRM'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* --------------------------------------------------- l'annonce du verdict

   Apres un duel contre un fantome, l'ecran de fin dit deja si le fantome est
   battu. Ce qui manque, c'est ce que ca change a la BATAILLE — et seul le
   serveur le sait : K.O., revanche, ou coequipier depasse. Monte une fois
   pour toutes (App.tsx), muet tant que rien n'arrive. */
export function AnnonceDuelMarques() {
  const fr = useFr();
  const reduit = useAnimationsReduites();
  const [v, setV] = useState<VerdictDuel | null>(null);
  useEffect(() => ecouterDuels(x => {
    if (!x.gagne) return;
    setV(x);
    if (x.ko) jouer(KO, 0, 0.8);
  }), []);
  useEffect(() => {
    if (!v) return;
    const t = setTimeout(() => setV(null), v.ko ? 3600 : 2600);
    return () => clearTimeout(t);
  }, [v]);
  const titre = !v ? '' : v.revanche ? (fr ? 'REVANCHE !' : 'REVENGE!') : v.ko ? 'K.O. !' : (fr ? 'DEVANT !' : 'AHEAD!');
  const camp: Camp = v ? (v.adverse ? (CAMPS.find(c => c !== v.cible_camp) as Camp) : v.cible_camp) : 'adidas';
  return (
    <AnimatePresence>
      {v && (
        <motion.div key={v.cible + v.ms} onClick={() => setV(null)}
          className="fixed inset-x-0 top-[12%] z-[80] flex justify-center px-6 pointer-events-auto"
          initial={reduit ? { opacity: 0 } : { opacity: 0, scale: 2.2, rotate: -6 }}
          animate={{ opacity: 1, scale: 1, rotate: 0 }}
          exit={{ opacity: 0, y: -20, transition: { duration: 0.25 } }}
          transition={reduit ? { duration: 0.2 } : RESSORT.trophee}>
          {/* aux couleurs du jeu (remarque de l'auteur, 13/10) : la carte, le
              jaune primaire et la police des titres de fin de course */}
          <div className="relative overflow-hidden rounded-2xl border-2 border-primary/70 px-6 py-3 flex flex-col items-center gap-1 bg-card/95 backdrop-blur-md"
               style={{ boxShadow: '0 0 40px rgb(var(--primaire-rgb) / 0.45)' }}>
            {!reduit && <Reflet vivant periode={0.8} delai={0.2} />}
            <span className="relative font-black font-display tracking-tight uppercase text-4xl leading-none text-primary drop-shadow-[0_0_30px_rgb(var(--primaire-rgb)/0.35)]">
              {titre}
            </span>
            <span className="relative text-[12px] text-foreground/90 text-center leading-snug">
              {v.ko
                ? (fr ? <><b>{v.cible}</b> est éliminé · Team {NOM_CAMP[camp]} −{secondes(v.epreuve in BONUS ? BONUS[v.epreuve] : 0)} s</>
                      : <><b>{v.cible}</b> is knocked out · Team {NOM_CAMP[camp]} −{secondes(v.epreuve in BONUS ? BONUS[v.epreuve] : 0)} s</>)
                : v.adverse
                  ? (fr ? <>Tu tiens déjà le duel contre <b>{v.cible}</b></> : <>You already hold the duel against <b>{v.cible}</b></>)
                  : (fr ? <>Tu passes devant le fantôme de <b>{v.cible}</b></> : <>You beat <b>{v.cible}</b>’s ghost</>)}
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
/** Le bonus d'un duel tenu, comme le serveur (worker/src/marques.js, BONUS_KO_MS). */
const BONUS: Record<Epreuve, number> = { '100': 100, '200': 200, '400': 400 };
