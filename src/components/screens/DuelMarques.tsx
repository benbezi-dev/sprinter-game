import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence, animate, useInView } from 'motion/react';
import { Loader2, Swords, Check } from 'lucide-react';
import { MONTEE, VOILE, PANNEAU, RESSORT, COURBE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  CAMPS, EPREUVES, NOM_CAMP, fetchMarques, choisirCamp, monInscription, ecouterMarques, manque,
  secondes, somme, type Camp, type Epreuve, type TableauMarques, type ChoixRefuse, type Inscription,
} from '@/game/marques';
import { useRetour } from '@/hooks/use-retour';

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

/** Le tableau, relu a l'ouverture et apres chaque course envoyee. */
function useTableau() {
  const [t, setT] = useState<TableauMarques | null>(null);
  const [erreur, setErreur] = useState(false);
  const relire = useCallback(() => {
    fetchMarques().then(x => { setT(x); setErreur(false); }).catch(() => setErreur(true));
  }, []);
  useEffect(() => { relire(); return ecouterMarques(relire); }, [relire]);
  return { t, erreur };
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

export function BanderoleMarques() {
  const fr = useFr();
  const [ouvert, setOuvert] = useState(false);
  const [ins, setIns] = useState<Inscription | null>(monInscription());
  useEffect(() => ecouterMarques(() => setIns(monInscription())), []);
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
        {ouvert && <EcranMarques onClose={() => setOuvert(false)} />}
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

export function EcranMarques({ onClose }: { onClose: () => void }) {
  useRetour(onClose);
  const fr = useFr();
  const reduit = useAnimationsReduites();
  const { t, erreur } = useTableau();
  const moi = t?.moi || null;
  const [vueCamp, setVueCamp] = useState<Camp | null>(null);
  const [vueEpreuve, setVueEpreuve] = useState<Epreuve | null>(null);
  const camp: Camp = vueCamp || moi?.camp || 'adidas';
  const epreuve: Epreuve = vueEpreuve || moi?.epreuve || '100';

  const courir = (e: Epreuve) => {
    onClose();
    (SprinterApp as any).startOneShot([e], { levelIdx: 4 });
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-6 flex flex-col items-center gap-4">

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
          <p className="text-sm text-muted-foreground py-8 text-center">
            {fr ? 'Le tableau ne répond pas. Réessaie dans un instant.' : 'The board is not answering. Try again in a moment.'}
          </p>
        )}

        {t && <Score t={t} fr={fr} reduit={reduit} />}

        <p className="w-full text-[10px] md:text-[11px] text-muted-foreground/85 text-center leading-snug px-2">
          {fr
            ? 'Tu choisis ton camp et ton épreuve. Ton meilleur chrono de la semaine compte. Sur chaque épreuve, les deux camps comptent autant de coureurs : s’il y a 14 Nike au 400 m, les 14 meilleurs adidas du 400 m comptent aussi. La plus petite somme gagne.'
            : 'Pick your side and your event. Your best time of the week counts. On each event both sides count the same number of runners: 14 Nike at 400 m means the 14 best adidas at 400 m count too. The lowest sum wins.'}
        </p>

        {t && !moi && <ChoixDuCamp t={t} fr={fr} reduit={reduit} />}

        {t && moi && <MaLigne t={t} fr={fr} courir={courir} reduit={reduit} />}

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
            <Coureurs key={camp + epreuve} t={t} camp={camp} epreuve={epreuve} fr={fr} reduit={reduit} />
          </>
        )}

        {t && moi && <Mention fr={fr} />}
      </div>
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
function MaLigne({ t, fr, courir, reduit }: { t: TableauMarques; fr: boolean; courir: (e: Epreuve) => void; reduit: boolean }) {
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
  return (
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
  );
}

/** Les coureurs d'un camp sur une epreuve : ceux qui comptent, puis les autres. */
function Coureurs({ t, camp, epreuve, fr, reduit }: { t: TableauMarques; camp: Camp; epreuve: Epreuve; fr: boolean; reduit: boolean }) {
  const k = t.epreuves[epreuve];
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
              <span className="flex-1 min-w-0 truncate text-sm font-bold">{r.name}</span>
              <span className="font-black tabular-nums text-sm" style={{ color: TEINTE[camp] }}>{secondes(r.ms)}</span>
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
