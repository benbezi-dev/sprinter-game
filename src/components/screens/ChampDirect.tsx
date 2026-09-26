import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { DUREE, COURBE, MONTEE, VOILE } from '@/lib/mouvement';
import {
  useChampDirect, quitterDirect, suivre, versLocal,
  type EtatChampDirect,
} from '@/game/champ-direct';
import type { Arrivee } from '@/game/live';

/**
 * UNE SERIE DE CHAMPIONNAT EN DIRECT, VUE DE L'ECRAN.
 *
 * Quatre moments, et un seul composant parce qu'ils se succedent sans jamais
 * se superposer : la chambre d'appel avant la presentation, la scene du
 * rappel apres un faux depart, le bandeau du spectateur pendant la course, le
 * tableau d'arrivee a la fin. La presentation elle-meme est celle du direct
 * (PresentationDirect), et la course a son HUD ordinaire.
 *
 * Il est monte a la racine, comme le rejeu : la piste une fois montee, le
 * panneau du championnat qui l'a ouvert n'existe plus.
 */

const OR = '#F8CD4A';
const ROUGE = '#EF4444';

export function ChampDirect() {
  const e = useChampDirect();
  if (!e.ouvert) return null;
  return (
    <AnimatePresence>
      {(e.etape === 'connexion' || e.etape === 'attente' || e.etape === 'erreur') &&
        <ChambreDAppel key="appel" e={e} />}
      {e.etape === 'rappel' && e.rappel &&
        <RappelEnScene key={'rappel' + e.rappel.debut}
                       fautifs={e.rappel.fautifs} moiSorti={e.rappel.moiSorti} />}
      {e.etape === 'course' && e.role === 'spectateur' && <BandeauSpectateur key="spec" e={e} />}
      {e.etape === 'fin' && e.resultat && <TableauDArrivee key="fin" e={e} />}
    </AnimatePresence>
  );
}

/* ------------------------------------------------------ la chambre d'appel */

function useMaintenant(pas = 250) {
  const [t, setT] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setT(Date.now()), pas);
    return () => clearInterval(id);
  }, [pas]);
  return t;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * LA CHAMBRE D'APPEL. Sur une vraie piste, c'est la piece ou l'on attend son
 * nom avant d'entrer dans le stade — et ou l'on apprend qu'un absent est
 * forfait. On y voit sa serie, son couloir, qui est la, et le temps qui reste.
 * Les deux regles qui peuvent couter la course sont dites ici, avant.
 */
function ChambreDAppel({ e }: { e: EtatChampDirect }) {
  const { N } = SprinterApp;
  const maintenant = useMaintenant();
  const c = e.salle?.champ;
  const grille = c?.grille || [];
  const moi = grille.find(g => g.cle === e.moi);
  // UN PARTANT QUE LA SALLE FAIT REGARDER. Son nom est sur la grille, mais la
  // salle l'a range parmi les spectateurs : ce telephone n'est pas relie a ce
  // nom, ou il arrive apres l'appel. Sans un mot, il attendait un depart qui
  // ne venait pas et finissait forfait (Steph Grondin27, serie 1, 26/09).
  const monNom = (getSavedName() || '').trim().toLowerCase();
  const partantEcarte = e.role === 'spectateur' && !!monNom
    && grille.some(g => g.cle === monNom);
  const pistolet = c?.at ? versLocal(c.at) - maintenant : null;
  const erreur = e.etape === 'erreur' ? (e.erreur || '') : (e.salle as any)?.erreur;
  return (
    <motion.div {...VOILE}
      className="absolute inset-0 z-40 flex items-center justify-center bg-black/85
                 px-[max(env(safe-area-inset-left),1rem)] pointer-events-auto">
      <motion.div {...MONTEE} className="w-full max-w-[420px] flex flex-col gap-3">
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.45em] text-white/45 uppercase">
            {c ? `${c.titre} · ${N.courseNom(c.phase, c.course, c.courses, c.phaseNom)}` : ''}
          </div>
          <div className="font-display font-black text-2xl tracking-widest" style={{ color: OR }}>
            {N.t('champ_appel')}
          </div>
          {moi && e.role === 'coureur' && (
            <div className="text-[12px] font-bold tracking-widest text-white/80 mt-1">
              {N.t('champ_ton_couloir', { c: moi.couloir })}
            </div>
          )}
          <div className="font-mono text-lg tabular-nums mt-1 text-white">
            {pistolet == null ? '' : pistolet > 30000
              ? N.t('champ_pistolet', { d: mmss(pistolet) })
              : N.t('champ_pistolet_imm')}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          {grille.map(g => {
            const forfait = g.statut === 'forfait';
            return (
              <div key={g.cle}
                className={`flex items-center gap-3 px-3 py-1.5 rounded-xl border
                  ${g.cle === e.moi ? 'border-primary/60 bg-primary/15' : 'border-white/8 bg-black/30'}
                  ${forfait ? 'opacity-40' : ''}`}>
                <span className="font-mono text-[10px] w-5 h-5 shrink-0 grid place-items-center
                                 rounded border border-white/15 bg-white/[0.04] text-white/50">
                  {g.couloir}
                </span>
                <span className="flex-1 min-w-0 truncate text-[12px] font-bold tracking-wide">
                  {g.nom}
                </span>
                <span className={`text-[9px] font-bold tracking-widest uppercase
                  ${forfait ? 'text-destructive' : g.present ? 'text-emerald-400' : 'text-white/35'}`}>
                  {forfait ? N.t('champ_dns') : g.present ? N.t('champ_present') : N.t('champ_attendu')}
                </span>
              </div>
            );
          })}
        </div>

        {partantEcarte && (
          <div className="text-center text-[11px] leading-relaxed rounded-xl border px-3 py-2
                          border-destructive/60 bg-destructive/15 text-white">
            {N.t(c?.etat === 'ouverte' ? 'champ_pas_reconnu' : 'champ_appel_ferme',
                 { n: getSavedName() || monNom })}
          </div>
        )}
        <div className="text-center text-[10px] tracking-wide text-white/55 leading-relaxed">
          {e.role === 'spectateur'
            ? N.t('champ_spectateur_n')
            : <>{N.t('champ_regle_appel')}<br />{N.t('champ_regle_fd')}</>}
        </div>
        {erreur && (
          <div className="text-center text-[11px] text-destructive">
            {erreur === 'fermee' || erreur === 'reseau' ? N.t('champ_salle_fermee') : String(erreur)}
          </div>
        )}
        <button onClick={() => quitterDirect()}
          className="self-center px-4 py-1.5 rounded-full border border-white/20 text-[10px]
                     font-bold tracking-widest text-white/70 active:scale-95 transition">
          {N.t('champ_dir_quitter')}
        </button>
      </motion.div>
    </motion.div>
  );
}

/* -------------------------------------------------------- la scene du rappel */

/**
 * L'instant de la scene, lu dans le moteur a chaque image.
 *
 * Le moteur tient le calendrier (G.rappel : la roulette, ses reperes) et fait
 * battre la camera et le son dessus ; l'ecran le lit au lieu de compter de
 * son cote, pour que l'image, le tic et le numero allume tombent ensemble —
 * en direct comme au rejeu, qui passent tous deux par rappelChamp.
 */
function useRappelDuMoteur() {
  const [, battre] = useState(0);
  // LE DERNIER ETAT CONNU. La scene se ferme en fondu, et le moteur a deja
  // efface son rappel quand le fondu commence : sans ce souvenir, l'ecran
  // retombait sur son premier plan et « FAUX DEPART » reapparaissait deux
  // dixiemes de seconde, en sortant.
  const dernier = useRef<ReturnType<typeof lire>>(null);
  useEffect(() => {
    let id = 0;
    const tic = () => { battre(x => x + 1); id = requestAnimationFrame(tic); };
    id = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(id);
  }, []);
  const m = lire();
  if (m) dernier.current = m;
  return m || dernier.current;
}

function lire() {
  const R = SprinterApp.G.rappel;
  if (!R) return null;
  let lane: number | null = null;
  if (R.t >= R.qui) for (const e of R.roulette) { if (e.t <= R.t) lane = e.lane; else break; }
  return { t: R.t as number, qui: R.qui as number, verdict: R.verdict as number,
           lignes: R.lignes as number[], cibles: R.cibles as number[], lane };
}

/**
 * LE RAPPEL, EN TROIS PLANS — cales sur le moteur (voir rappelChamp).
 *
 *   « FAUX DEPART »  le double coup de feu ; tout le monde revient ;
 *   « QUI ? »        on sait qu'il y a eu faute, pas qui. Les numeros de la
 *                    ligne en haut d'ecran, une lumiere qui passe de l'un a
 *                    l'autre en ralentissant, s'arrete sur un voisin… puis
 *                    bascule. Le mot bat avec le coeur ;
 *   LE VERDICT       le couloir vire au rouge, le carton tombe — nom,
 *                    couloir, instant, que personne ne le conteste. Un second
 *                    fautif a le sien, une demi-seconde apres.
 *
 * Rien n'est dessine sur la piste : ni nom ni cerceau en championnat. Le
 * voile reste leger, la scene se passe SUR la piste.
 */
export function RappelEnScene({ fautifs, moiSorti }: {
  fautifs: { id: string; nom: string; couloir: number; ms: number }[];
  moiSorti: boolean;
}) {
  const { N } = SprinterApp;
  const m = useRappelDuMoteur();
  const t = m ? m.t : 0;
  const qui = m ? m.qui : 1.4, verdict = m ? m.verdict : 4.3;
  const plan: 'fd' | 'qui' | 'verdict' = t < qui ? 'fd' : t < verdict ? 'qui' : 'verdict';
  // les couloirs tels qu'on les lit peints : l'indice du moteur plus un
  const lignes = (m ? m.lignes : []).map(l => l + 1);
  const rouges = new Set((m ? m.cibles : []).map(l => l + 1));
  const allume = m && m.lane != null ? m.lane + 1 : null;
  // le battement du « QUI ? », de plus en plus serre
  const avance = Math.min(1, Math.max(0, (t - qui) / (verdict - qui)));
  const periode = 0.62 - 0.26 * avance;
  const phase = ((t - qui) % periode) / periode;
  const pouls = plan === 'qui' ? 1 + 0.09 * Math.max(0, 1 - phase * 4) : 1;
  const tries = [...fautifs].sort((a, b) => a.couloir - b.couloir);
  const virgule = (ms: number) => (Math.abs(ms) / 1000).toFixed(3)
    .replace('.', N.getLang() === 'en' ? '.' : ',') + ' s';

  return (
    <motion.div className="absolute inset-0 z-40 pointer-events-none flex flex-col items-center justify-center"
      initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: DUREE.rapide } }}>
      {/* le flash du double coup de feu, puis celui du verdict */}
      <motion.div className="absolute inset-0 bg-destructive"
        initial={{ opacity: 0.8 }}
        animate={{ opacity: [0.8, 0.08, 0.45, 0.06] }}
        transition={{ duration: DUREE.scene, times: [0, 0.2, 0.35, 1] }} />
      {plan === 'verdict' && (
        <motion.div key="eclair" className="absolute inset-0 bg-destructive"
          initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />
      )}
      {/* pendant le doute, l'image s'assombrit sur les bords : on retient son souffle */}
      <motion.div className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.55) 100%)' }}
        animate={{ opacity: plan === 'qui' ? 1 : 0 }} transition={{ duration: 0.4 }} />
      {[0, 1].map(i => (
        <motion.div key={i} className="absolute left-0 right-0 h-px bg-destructive/70"
          style={{ top: i === 0 ? '34%' : '66%' }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.2 + i * 0.1, ease: COURBE.sortie }} />
      ))}

      {/* LA LIGNE, EN HAUT : les couloirs presents, la lumiere qui cherche */}
      {plan !== 'fd' && lignes.length > 0 && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="absolute top-[calc(max(env(safe-area-inset-top),0.75rem)+2.5rem)] flex gap-1.5">
          {lignes.map(c => {
            const cible = plan === 'verdict' && rouges.has(c);
            const lumiere = plan === 'qui' && allume === c;
            return (
              <motion.div key={c}
                animate={cible ? { scale: [1, 1.35, 1.15] } : { scale: lumiere ? 1.12 : 1 }}
                transition={{ duration: cible ? 0.35 : 0.08 }}
                className={`w-8 h-9 rounded-md grid place-items-center font-display font-black text-base
                  tabular-nums border transition-colors duration-75
                  ${cible ? 'bg-destructive border-destructive text-white shadow-[0_0_24px_rgba(239,68,68,0.8)]'
                    : lumiere ? 'bg-white border-white text-black shadow-[0_0_18px_rgba(255,255,255,0.7)]'
                    : 'bg-black/55 border-white/20 text-white/70'}`}>
                {c}
              </motion.div>
            );
          })}
        </motion.div>
      )}

      <AnimatePresence mode="wait">
        {plan === 'fd' && (
          <motion.div key="fd" className="relative flex flex-col items-center gap-2 text-center"
            exit={{ opacity: 0, y: -10, transition: { duration: 0.15 } }}>
            <motion.h1
              initial={{ scale: 1.7, opacity: 0, letterSpacing: '0.3em' }}
              animate={{ scale: 1, opacity: 1, letterSpacing: '0em' }}
              transition={{ duration: DUREE.ample, ease: COURBE.elan }}
              className="text-5xl sm:text-6xl font-black font-display uppercase
                         text-destructive drop-shadow-[0_0_40px_rgba(239,68,68,0.55)]">
              {N.t('champ_fd')}
            </motion.h1>
            <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-sm font-black tracking-[0.35em] uppercase text-white
                         drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              {N.t('champ_fd_retour')}
            </motion.span>
          </motion.div>
        )}

        {plan === 'qui' && (
          <motion.div key="qui" className="relative flex flex-col items-center gap-2 text-center"
            initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.12 } }}>
            <div style={{ transform: `scale(${pouls})` }}
              className="font-display font-black text-7xl text-white tracking-tight
                         drop-shadow-[0_0_30px_rgba(0,0,0,0.9)]">
              {N.t('champ_qui')}
            </div>
            <span className="text-[11px] font-bold tracking-[0.3em] uppercase text-white/75
                             drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
              {N.t('champ_juge')}
            </span>
          </motion.div>
        )}

        {plan === 'verdict' && (
          <motion.div key="verdict" className="relative flex flex-col items-center gap-3">
            <div className="flex gap-3">
              {tries.map((f, i) => (
                <motion.div key={f.id}
                  initial={{ y: -260, rotate: -24, opacity: 0, scale: 1.4 }}
                  animate={{ y: 0, rotate: -6 + i * 10, opacity: 1, scale: 1 }}
                  transition={{ type: 'spring', stiffness: 420, damping: 16, delay: i * 0.45 }}
                  className="w-[118px] h-[160px] rounded-lg flex flex-col items-center justify-between
                             py-3 px-2 shadow-[0_18px_40px_rgba(0,0,0,0.6)]"
                  style={{ background: `linear-gradient(160deg, #ff5a5a, ${ROUGE} 45%, #b91c1c)` }}>
                  <span className="text-[9px] font-black tracking-[0.3em] text-white/85">
                    {N.t('champ_carton')}
                  </span>
                  <span className="font-display font-black text-4xl text-white tabular-nums">
                    {f.couloir}
                  </span>
                  <span className="text-[11px] font-black text-white text-center leading-tight line-clamp-2">
                    {f.nom}
                  </span>
                </motion.div>
              ))}
            </div>
            {tries.length > 1 && (
              <motion.div initial={{ opacity: 0, scale: 1.4 }} animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm font-black tracking-widest uppercase text-destructive
                           drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                {N.t('champ_deuxieme')}
              </motion.div>
            )}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.35 + (tries.length - 1) * 0.45 }}
              className="text-[10px] font-mono tracking-widest text-white/85
                         drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)] text-center">
              {tries.map(f => `${f.nom} — ${N.t('champ_fd_instant', { ms: virgule(f.ms) })}`).join('  ·  ')}
            </motion.div>
            {moiSorti && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="text-sm font-black tracking-widest uppercase text-white
                           drop-shadow-[0_2px_6px_rgba(0,0,0,0.8)]">
                {N.t('champ_fd_moi')}
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ------------------------------------------------------ le bandeau spectateur */

/**
 * SORTI, ON REGARDE. Le bandeau dit pourquoi — un carton rouge, ou tout
 * simplement qu'on n'est pas partant — et les couloirs encore en lice se
 * touchent pour changer de coureur suivi. Rien d'autre : c'est la course
 * qu'on est venu voir.
 */
function BandeauSpectateur({ e }: { e: EtatChampDirect }) {
  const { N } = SprinterApp;
  const enLice = (e.salle?.joueurs || []).filter(j => j.statut === 'engage')
    .sort((a, b) => (a.couloir || 0) - (b.couloir || 0));
  return (
    <motion.div {...MONTEE}
      className="absolute top-[calc(max(env(safe-area-inset-top),0.75rem)+2.25rem)] left-0 right-0 z-30
                 flex flex-col items-center gap-2 pointer-events-none">
      <div className={`px-3 py-1 rounded-full text-[10px] font-black tracking-[0.3em]
        ${e.sorti ? 'bg-destructive text-white' : 'bg-black/60 text-white/80 border border-white/15'}`}>
        {N.t(e.sorti ? 'champ_spectateur' : 'champ_regarde')}
      </div>
      <div className="flex gap-1.5 pointer-events-auto">
        {enLice.map(j => (
          <button key={j.id} onClick={() => suivre(j.id)}
            title={`${N.t('champ_suivre')} ${j.nom}`}
            className={`min-w-7 h-7 px-1.5 rounded-md text-[11px] font-black tabular-nums border
              active:scale-95 transition
              ${e.suivi === j.id ? 'bg-white text-black border-white' : 'bg-black/55 text-white border-white/25'}`}>
            {j.couloir}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

/* ------------------------------------------------------ le tableau d'arrivee */

function chrono(ms: number) {
  return (ms / 1000).toFixed(3).replace('.', SprinterApp.N.getLang() === 'en' ? '.' : ',');
}

function marque(l: Arrivee): { texte: string; couleur: string } {
  const { N } = SprinterApp;
  if (l.motif === 'faux_depart') return { texte: N.t('champ_dq'), couleur: ROUGE };
  if (l.motif === 'forfait') return { texte: N.t('champ_dns'), couleur: 'rgba(255,255,255,0.4)' };
  if (l.abandon || l.motif === 'abandon') return { texte: N.t('champ_dnf'), couleur: 'rgba(255,255,255,0.55)' };
  return { texte: chrono(l.ms), couleur: l.place === 1 ? OR : 'rgba(255,255,255,0.75)' };
}

/**
 * L'ARRIVEE. Les classes au chrono, puis ceux qui n'en ont pas, chacun avec
 * la raison — DQ en rouge, abandon, forfait. Un carton rouge n'est pas une
 * neuvieme place : il n'a pas de rang.
 */
function TableauDArrivee({ e }: { e: EtatChampDirect }) {
  const { N } = SprinterApp;
  const c = e.salle?.champ;
  const lignes = e.resultat!.classement;
  return (
    <motion.div {...MONTEE}
      className="absolute inset-0 z-40 flex items-center justify-center
                 bg-gradient-to-b from-black/85 via-black/75 to-black/90
                 px-[max(env(safe-area-inset-left),1rem)] pointer-events-auto">
      <div className="w-full max-w-[420px] flex flex-col gap-3">
        <div className="text-center">
          <div className="text-[9px] font-bold tracking-[0.45em] text-white/45 uppercase">
            {c ? c.titre : ''}
          </div>
          <div className="font-display font-black text-2xl tracking-widest" style={{ color: OR }}>
            {c ? (N.courseNom(c.phase, c.course, c.courses, c.phaseNom)) : ''}
          </div>
        </div>
        <div className="flex flex-col gap-1">
          {lignes.map((l, i) => {
            const m = marque(l);
            return (
              <motion.div key={l.id}
                initial={{ opacity: 0, x: 18 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, duration: 0.22 }}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl border
                  ${l.id === e.moi ? 'border-primary/60 bg-primary/15'
                    : l.motif === 'faux_depart' ? 'border-destructive/40 bg-destructive/10'
                    : 'border-white/8 bg-black/30'}`}>
                <span className="font-display font-black text-base w-5 shrink-0 tabular-nums"
                      style={{ color: l.place === 1 ? OR : 'rgba(255,255,255,0.55)' }}>
                  {l.motif ? '—' : l.place}
                </span>
                <span className="font-mono text-[10px] w-5 h-5 shrink-0 grid place-items-center
                                 rounded border border-white/15 bg-white/[0.04] text-white/50">
                  {l.couloir ?? '—'}
                </span>
                <span className="flex-1 min-w-0 truncate text-[12px] font-bold tracking-wide">{l.nom}</span>
                <span className="font-mono text-[12px] tabular-nums shrink-0 font-bold"
                      style={{ color: m.couleur }}>{m.texte}</span>
              </motion.div>
            );
          })}
        </div>
        <div className="text-center text-[10px] tracking-wide text-white/55 min-h-[14px]">
          {e.enregistre ? (e.enregistre.ok ? N.t('champ_officiel')
            : N.t('champ_officiel_ko', { e: e.enregistre.erreur || '?' })) : ''}
        </div>
        <button onClick={() => quitterDirect()}
          className="self-center px-4 py-2 rounded-full border border-primary/40 bg-primary/10
                     text-primary text-[10px] font-bold tracking-widest active:scale-95 transition">
          {N.t('champ_retour')}
        </button>
      </div>
    </motion.div>
  );
}
