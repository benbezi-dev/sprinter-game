import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Star, Snowflake, Ghost, RotateCcw, Crosshair } from 'lucide-react';
import { MONTEE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { useRetour } from '@/hooks/use-retour';
import { surCourrier, reprendreTouchee } from '@/game/boite';
import {
  fetchTableau, defier, deposer, lancerBoules, ecouterNoel, secondes, duree,
  dernierVerdict, oublierVerdict,
  type TableauNoel, type LigneNoel, type VerdictNoel, type FilNoel,
} from '@/game/noel';

/* ---------------------------------------------------------------------------
   NOEL 2026 — LA BATAILLE DE BOULES DE NEIGE ET L'ETOILE DU SAPIN.

   La banniere de l'accueil dit qui tient l'etoile et depuis combien de temps,
   le chrono a battre montant sous les yeux. L'ecran : l'etoile en grand, ta
   poche de boules, l'arene (tous les fantomes, avec leur neige), le fil de la
   bataille et le classement. Les regles : worker/src/noel.js.

   LE CHRONO DE L'ETOILE TOURNE A L'ECRAN, sans redemander le serveur : son
   poids ne depend que du temps tenu, et le serveur a donne la formule
   (`regles`). La neige, elle, ne bouge qu'avec un lancer : on relit alors.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const GLACE = '#bfe6ff';
const OR = '#ffd426';
const ROUGE = '#ff5a5a';

function useFr() { return SprinterApp.N.getLang() === 'fr'; }

/** Une horloge qui bat chaque seconde. */
function useMaintenant(pas = 1000) {
  const [t, setT] = useState(Date.now());
  useEffect(() => { const id = setInterval(() => setT(Date.now()), pas); return () => clearInterval(id); }, [pas]);
  return t;
}

/** Le tableau, relu au besoin et toutes les 30 s ; `decalage` recale l'horloge locale sur celle du serveur. */
function useTableau() {
  const [t, setT] = useState<TableauNoel | null>(null);
  const [erreur, setErreur] = useState(false);
  const [decalage, setDecalage] = useState(0);
  const relire = useCallback(async () => {
    try {
      const d = await fetchTableau();
      setT(d); setErreur(false); setDecalage(d.maintenant - Date.now());
    } catch { setErreur(true); }
  }, []);
  useEffect(() => {
    relire();
    const id = setInterval(relire, 30_000);
    const off = ecouterNoel(relire);
    return () => { clearInterval(id); off(); };
  }, [relire]);
  return { t, erreur, relire, decalage };
}

/** Ce que vaut l'etoile maintenant, calcule a l'ecran avec la formule du serveur. */
function etoileMaintenant(t: TableauNoel, maintenant: number) {
  const e = t.etoile;
  if (!e || e.ms == null) return null;
  const tenue = Math.max(0, maintenant - e.depuis);
  const poids = Math.min(t.regles.etoile_max, tenue / 3_600_000 * t.regles.etoile_pct_h);
  const neige = Math.min(t.regles.neige_max, e.neige) * t.regles.neige_pct;
  return { tenue, poids, aBattre: Math.round(e.ms * (1 + neige) * (1 + poids)) };
}

let rouvrirAuRetour = false;

/* ============================================================== la banniere */

export function BanderoleNoel() {
  const fr = useFr();
  const reduit = useAnimationsReduites();
  const [ouvert, setOuvert] = useState(rouvrirAuRetour);
  useEffect(() => { rouvrirAuRetour = false; }, []);
  useEffect(() => {
    const ouvrirSi = (q: string | null) => { if (q) setOuvert(true); };
    ouvrirSi(reprendreTouchee(['noel_etoile', 'noel_neige']));
    return surCourrier(() => ouvrirSi(reprendreTouchee(['noel_etoile', 'noel_neige'])));
  }, []);
  const { t, decalage } = useTableau();
  const maintenant = useMaintenant() + decalage;
  const e = t ? etoileMaintenant(t, maintenant) : null;

  return (
    <motion.div {...MONTEE}>
      <motion.button onClick={() => setOuvert(true)} whileTap={{ scale: 0.98 }}
        className="relative w-full rounded-2xl border-2 overflow-hidden flex items-center gap-3 px-3 py-2.5 text-left"
        style={{ borderColor: GLACE, background: 'linear-gradient(100deg, rgba(191,230,255,0.16), rgba(255,212,38,0.14))' }}>
        <Flocons reduit={reduit} />
        <motion.span className="relative shrink-0"
          animate={reduit ? {} : { rotate: [0, 12, -12, 0], scale: [1, 1.15, 1] }}
          transition={reduit ? {} : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
          <Star className="w-7 h-7" style={{ color: OR, fill: OR }} aria-hidden />
        </motion.span>
        <span className="relative flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 truncate">
            {fr ? 'Noël · boules de neige · 60 m' : 'Christmas · snowballs · 60 m'}
          </span>
          <span className="font-black text-sm md:text-base leading-tight truncate">
            {t?.etoile
              ? (fr ? `★ ${t.etoile.name} tient l'étoile` : `★ ${t.etoile.name} holds the star`)
              : (fr ? 'L’étoile attend son premier coureur' : 'The star awaits its first runner')}
          </span>
          <span className="text-[10px] md:text-xs text-foreground/70 leading-snug truncate">
            {e
              ? (fr ? `depuis ${duree(e.tenue)} · à battre ${secondes(e.aBattre)} s`
                    : `for ${duree(e.tenue, false)} · beat ${secondes(e.aBattre, false)} s`)
              : (fr ? 'Bats des fantômes, lance des boules, vole l’étoile' : 'Beat ghosts, throw snowballs, steal the star')}
          </span>
        </span>
        <span className="relative shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest"
              style={{ background: GLACE }}>
          {fr ? 'ENTRER' : 'ENTER'}
        </span>
      </motion.button>
      <AnimatePresence>
        {ouvert && <EcranNoel onClose={() => setOuvert(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/** Quelques flocons qui tombent dans la banniere. */
function Flocons({ reduit }: { reduit: boolean }) {
  if (reduit) return null;
  return (
    <span aria-hidden className="absolute inset-0 pointer-events-none">
      {[8, 23, 41, 58, 74, 90].map((x, i) => (
        <motion.span key={x} className="absolute text-[10px]" style={{ left: `${x}%`, top: -10, color: GLACE, opacity: 0.6 }}
          animate={{ y: [0, 80], opacity: [0, 0.8, 0] }}
          transition={{ duration: 3 + (i % 3), delay: i * 0.6, repeat: Infinity, ease: 'linear' }}>❄</motion.span>
      ))}
    </span>
  );
}

/* ============================================================== l'ecran */

export function EcranNoel({ onClose }: { onClose: () => void }) {
  useRetour(onClose);
  const fr = useFr();
  const { t, erreur, relire, decalage } = useTableau();
  const maintenant = useMaintenant() + decalage;
  const [enRoute, setEnRoute] = useState<string | null>(null);
  const [visee, setVisee] = useState<LigneNoel | null>(null);
  const [verdict, setVerdict] = useState<VerdictNoel | null>(dernierVerdict);
  useEffect(() => { oublierVerdict(); }, []);
  const nom = getSavedName();

  const partir = async (cible: string | null) => {
    if (enRoute) return;
    if (!cible) { rouvrirAuRetour = true; onClose(); deposer(); return; }
    setEnRoute(cible);
    const ok = await defier(cible);
    setEnRoute(null);
    if (ok) { rouvrirAuRetour = true; onClose(); }
  };

  const moi = t?.moi || null;
  const e = t ? etoileMaintenant(t, maintenant) : null;

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-4">
        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 className="font-display font-black text-2xl md:text-3xl leading-none" style={{ color: GLACE }}>
              {fr ? 'LA BATAILLE DE NOËL' : 'THE CHRISTMAS BATTLE'}
            </h2>
            <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide mt-1">
              {fr ? '60 m · boules de neige · une seule étoile' : '60 m · snowballs · one single star'}
              {t?.fin ? ` · ${fr ? 'fin le' : 'ends'} ${new Date(t.fin).toLocaleString(fr ? 'fr-FR' : 'en-GB',
                { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors shrink-0">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {!t && !erreur && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-8" aria-hidden />}
        {erreur && !t && (
          <button onClick={relire} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/80 border border-white/10 text-sm">
            <RotateCcw className="w-4 h-4" aria-hidden /> {fr ? 'Le tableau ne répond pas. Réessayer' : 'The board is not answering. Try again'}
          </button>
        )}

        <AnimatePresence>
          {verdict && <Verdict v={verdict} fr={fr} onDone={() => setVerdict(null)} />}
        </AnimatePresence>

        {t && (
          <CarteEtoile t={t} e={e} fr={fr} moiKey={moi?.key || null} enRoute={enRoute}
                       defier={() => t.etoile && partir(t.etoile.name)}
                       viser={() => { const l = t.arene.find(a => a.etoile); if (l) setVisee(l); }} />
        )}

        {t && <MaLigne t={t} fr={fr} nom={nom} partir={() => partir(null)} />}

        {t && t.arene.length > 0 && (
          <Arene t={t} fr={fr} enRoute={enRoute} defier={(n) => partir(n)} viser={setVisee} />
        )}

        {t && t.fil.length > 0 && <Fil fil={t.fil} fr={fr} />}

        {t && t.classement.length > 0 && <Classement t={t} fr={fr} />}

        {t && <Regles t={t} fr={fr} />}
      </div>

      <AnimatePresence>
        {visee && t && (
          <Lanceur cible={visee} boules={moi?.boules ?? 0} max={t.regles.neige_max} pct={t.regles.neige_pct} fr={fr}
                   onClose={() => setVisee(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- l'etoile */

function CarteEtoile({ t, e, fr, moiKey, enRoute, defier, viser }: {
  t: TableauNoel; e: ReturnType<typeof etoileMaintenant>; fr: boolean; moiKey: string | null;
  enRoute: string | null; defier: () => void; viser: () => void;
}) {
  const reduit = useAnimationsReduites();
  const et = t.etoile;
  const aMoi = !!et && et.key === moiKey;
  return (
    <div className="relative w-full rounded-2xl border-2 p-4 overflow-hidden"
         style={{ borderColor: OR, background: 'radial-gradient(circle at 50% 0%, rgba(255,212,38,0.22), rgba(0,0,0,0) 70%)' }}>
      <div className="flex items-center gap-3">
        <motion.span animate={reduit ? {} : { rotate: [0, 360] }} transition={reduit ? {} : { duration: 12, repeat: Infinity, ease: 'linear' }}>
          <Star className="w-10 h-10" style={{ color: OR, fill: OR }} aria-hidden />
        </motion.span>
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/70">{fr ? 'L’étoile du sapin' : 'The tree star'}</div>
          <div className="font-black text-xl leading-tight truncate">
            {et ? (aMoi ? (fr ? 'C’est toi qui la tiens !' : 'You hold it!') : et.name)
                : (fr ? 'Personne. Cours le premier.' : 'Nobody. Run first.')}
          </div>
          {et && e && (
            <div className="text-xs text-foreground/75 tabular-nums">
              {fr ? 'tenue depuis ' : 'held for '}<b>{duree(e.tenue, fr)}</b>
              {' · '}{fr ? 'poids ' : 'weight '}<b>+{(e.poids * 100).toLocaleString(fr ? 'fr-FR' : 'en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</b>
              {et.neige ? <> · <span style={{ color: GLACE }}>❄{et.neige}</span></> : null}
            </div>
          )}
        </div>
      </div>
      {et && e && (
        <div className="mt-3 flex items-end justify-between gap-3">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-white/60">{fr ? 'Chrono à battre' : 'Time to beat'}</div>
            <div className="font-display font-black text-3xl tabular-nums" style={{ color: OR }}>{secondes(e.aBattre, fr)} s</div>
            <div className="text-[10px] text-muted-foreground">{fr ? `son fantôme : ${secondes(et.ms!, fr)} s, il ralentit chaque minute` : `ghost: ${secondes(et.ms!, fr)} s, slowing every minute`}</div>
          </div>
          {!aMoi && (
            <div className="flex flex-col gap-1.5 shrink-0">
              <button onClick={defier} disabled={!!enRoute}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl font-black text-xs text-black disabled:opacity-60" style={{ background: OR }}>
                {enRoute === et.name ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ghost className="w-4 h-4" />}
                {fr ? 'VOLER L’ÉTOILE' : 'STEAL THE STAR'}
              </button>
              {moiKey && (
                <button onClick={viser} className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl font-black text-xs text-black" style={{ background: GLACE }}>
                  <Snowflake className="w-4 h-4" /> {fr ? 'L’ENNEIGER' : 'SNOW IT'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {aMoi && (
        <p className="mt-2 text-[11px] text-foreground/75">
          {fr ? 'Tout le jeu te chasse. Tu gagnes un point par quart d’heure. Recourir secoue la neige, mais pas le poids de l’étoile.'
              : 'Everyone is hunting you. One point per quarter hour. Running again shakes off snow, not the star’s weight.'}
        </p>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- ma ligne */

function MaLigne({ t, fr, nom, partir }: { t: TableauNoel; fr: boolean; nom: string | null; partir: () => void }) {
  const moi = t.moi;
  if (!nom) {
    return <p className="text-sm text-muted-foreground text-center">{fr ? 'Choisis d’abord ton nom de coureur.' : 'Pick your runner name first.'}</p>;
  }
  return (
    <div className="w-full rounded-2xl bg-card/70 border border-white/10 p-3 flex flex-col gap-2">
      {moi ? (
        <div className="grid grid-cols-4 gap-2 text-center">
          <Chiffre v={String(moi.points)} l={fr ? 'points' : 'points'} />
          <Chiffre v={`#${moi.rang}`} l={fr ? 'rang' : 'rank'} />
          <Chiffre v={String(moi.boules)} l={fr ? 'boules ❄' : 'snowballs ❄'} c={GLACE} />
          <Chiffre v={secondes(moi.a_battre_ms, fr)} l={fr ? 'ton fantôme' : 'your ghost'} />
        </div>
      ) : (
        <p className="text-sm text-center">{fr
          ? `Cours un 60 m pour entrer : ton fantôme rejoint l’arène et tu reçois ${t.regles.boules_depart} boules de neige.`
          : `Run a 60 m to enter: your ghost joins the arena and you get ${t.regles.boules_depart} snowballs.`}</p>
      )}
      {moi && moi.neige > 0 && (
        <p className="text-xs font-bold text-center" style={{ color: GLACE }}>
          {fr ? `❄ Ton fantôme porte ${moi.neige} boule${moi.neige > 1 ? 's' : ''} : il court en ${secondes(moi.a_battre_ms, fr)} au lieu de ${secondes(moi.ms, fr)}. Recours pour secouer la neige.`
              : `❄ Your ghost carries ${moi.neige} snowball${moi.neige > 1 ? 's' : ''}: it runs ${secondes(moi.a_battre_ms, fr)} instead of ${secondes(moi.ms, fr)}. Run again to shake it off.`}
        </p>
      )}
      <button onClick={partir} className="w-full py-2.5 rounded-xl font-black text-sm text-black bg-white">
        {moi ? (fr ? 'RECOURIR (NOUVEAU FANTÔME)' : 'RUN AGAIN (NEW GHOST)') : (fr ? 'ENTRER DANS L’ARÈNE' : 'ENTER THE ARENA')}
      </button>
      {moi && <p className="text-[10px] text-muted-foreground text-center">{fr ? 'Attention : ton fantôme devient ta dernière course, même ratée.' : 'Careful: your ghost becomes your latest run, even a bad one.'}</p>}
    </div>
  );
}

function Chiffre({ v, l, c }: { v: string; l: string; c?: string }) {
  return (
    <div className="flex flex-col">
      <span className="font-display font-black text-lg tabular-nums" style={c ? { color: c } : undefined}>{v}</span>
      <span className="text-[9px] uppercase tracking-wider text-muted-foreground">{l}</span>
    </div>
  );
}

/* ---------------------------------------------------------------- l'arene */

function Arene({ t, fr, enRoute, defier, viser }: {
  t: TableauNoel; fr: boolean; enRoute: string | null; defier: (n: string) => void; viser: (l: LigneNoel) => void;
}) {
  const moi = t.moi;
  return (
    <div className="w-full flex flex-col gap-1.5">
      <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? 'L’arène' : 'The arena'} · {t.arene.length}</h3>
      <p className="text-[10px] text-muted-foreground">{fr ? 'Chaque fantôme battu : 1 point et 1 boule (une fois par version de son fantôme).' : 'Each ghost beaten: 1 point and 1 snowball (once per version of their ghost).'}</p>
      {t.arene.map(l => {
        const soi = moi && l.key === moi.key;
        // a ta portee : ton propre fantome est plus rapide que son chrono a battre
        const portee = moi && !soi && moi.ms < l.a_battre_ms && !l.deja_battu;
        return (
          <div key={l.key} className="flex items-center gap-2 px-2.5 py-2 rounded-xl border"
               style={{ borderColor: l.etoile ? OR : portee ? 'rgba(191,230,255,0.5)' : 'rgba(255,255,255,0.08)',
                        background: soi ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.25)' }}>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-sm truncate">
                {l.etoile && <Star className="inline w-3.5 h-3.5 mr-1 -mt-0.5" style={{ color: OR, fill: OR }} />}
                {l.name}{soi ? (fr ? ' (toi)' : ' (you)') : ''}
                {l.neige > 0 && <span className="ml-1.5 text-xs" style={{ color: GLACE }}>❄{l.neige}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground tabular-nums">
                {fr ? 'à battre ' : 'beat '}<b className="text-foreground/90">{secondes(l.a_battre_ms, fr)}</b>
                {l.a_battre_ms !== l.ms && <span> ({secondes(l.ms, fr)})</span>}
                {l.deja_battu && <span> · {fr ? 'déjà battu' : 'already beaten'}</span>}
                {portee && <span style={{ color: GLACE }}> · {fr ? 'à ta portée' : 'within reach'}</span>}
              </div>
            </div>
            {!soi && (
              <>
                {moi && (
                  <button onClick={() => viser(l)} aria-label={fr ? 'Lancer des boules' : 'Throw snowballs'}
                          className="p-2 rounded-lg text-black" style={{ background: GLACE }}>
                    <Snowflake className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => defier(l.name)} disabled={!!enRoute}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg text-[11px] font-black bg-white text-black disabled:opacity-60">
                  {enRoute === l.name ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Crosshair className="w-3.5 h-3.5" />}
                  {fr ? 'DÉFIER' : 'RACE'}
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- lancer */

function Lanceur({ cible, boules, max, pct, fr, onClose }: {
  cible: LigneNoel; boules: number; max: number; pct: number; fr: boolean; onClose: () => void;
}) {
  const place = Math.max(0, max - cible.neige);
  const plafond = Math.min(boules, place);
  const [n, setN] = useState(Math.min(1, plafond));
  const [occupe, setOccupe] = useState(false);
  const [msg, setMsg] = useState('');
  const apres = Math.round(cible.ms * (1 + (cible.neige + n) * pct) * (cible.a_battre_ms / (cible.ms * (1 + cible.neige * pct))));
  const go = async () => {
    setOccupe(true); setMsg('');
    const r = await lancerBoules(cible.name, n);
    setOccupe(false);
    if (r.ok) onClose();
    else setMsg(r.error === 'plus de boules' ? (fr ? 'Plus de boules : bats des fantômes pour en gagner.' : 'No snowballs left: beat ghosts to earn some.')
                : r.error === 'deja couvert de neige' ? (fr ? 'Il est déjà couvert de neige.' : 'Already covered in snow.')
                : (fr ? 'Le lancer n’est pas parti. Réessaie.' : 'The throw failed. Try again.'));
  };
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-end md:items-center justify-center bg-black/60 p-4"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div className="w-full max-w-sm rounded-2xl bg-card border-2 p-4 flex flex-col gap-3" style={{ borderColor: GLACE }}
                  initial={{ y: 40 }} animate={{ y: 0 }} exit={{ y: 40 }} onClick={ev => ev.stopPropagation()}>
        <div className="font-black text-lg">❄ {fr ? `Enneiger ${cible.name}` : `Snow ${cible.name}`}</div>
        {plafond < 1 ? (
          <p className="text-sm text-muted-foreground">{boules < 1
            ? (fr ? 'Tu n’as plus de boules. Chaque fantôme battu t’en donne une.' : 'You have no snowballs. Each ghost you beat gives you one.')
            : (fr ? 'Il est déjà couvert de neige au maximum.' : 'Already fully covered in snow.')}</p>
        ) : (
          <>
            <div className="flex items-center justify-center gap-4">
              <button onClick={() => setN(Math.max(1, n - 1))} className="w-10 h-10 rounded-xl bg-white/10 font-black text-xl">−</button>
              <span className="font-display font-black text-4xl tabular-nums w-14 text-center" style={{ color: GLACE }}>{n}</span>
              <button onClick={() => setN(Math.min(plafond, n + 1))} className="w-10 h-10 rounded-xl bg-white/10 font-black text-xl">+</button>
            </div>
            <p className="text-xs text-center text-foreground/80 tabular-nums">
              {fr ? `Son chrono à battre passe de ${secondes(cible.a_battre_ms)} à ${secondes(apres)} s pendant 24 h, sauf s’il recourt.`
                  : `Their time to beat goes from ${secondes(cible.a_battre_ms, false)} to ${secondes(apres, false)} s for 24 h, unless they run again.`}
            </p>
            <p className="text-[10px] text-center text-muted-foreground">{fr ? `Il te reste ${boules} boule${boules > 1 ? 's' : ''}.` : `You have ${boules} snowball${boules > 1 ? 's' : ''}.`}</p>
            <button onClick={go} disabled={occupe} className="w-full py-2.5 rounded-xl font-black text-black disabled:opacity-60" style={{ background: GLACE }}>
              {occupe ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : (fr ? `LANCER ${n} BOULE${n > 1 ? 'S' : ''}` : `THROW ${n}`)}
            </button>
          </>
        )}
        {msg && <p className="text-xs text-center" style={{ color: ROUGE }}>{msg}</p>}
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- verdict */

function Verdict({ v, fr, onDone }: { v: VerdictNoel; fr: boolean; onDone: () => void }) {
  const d = v.duel;
  let titre = fr ? `Ton nouveau fantôme : ${secondes(v.ms)} s` : `Your new ghost: ${secondes(v.ms, false)} s`;
  let couleur = 'white';
  if (d && d.etoile) { titre = fr ? `★ TU AS VOLÉ L’ÉTOILE À ${d.cible.toUpperCase()} !` : `★ YOU STOLE THE STAR FROM ${d.cible.toUpperCase()}!`; couleur = OR; }
  else if (d && d.gagne && d.nouveau) { titre = fr ? `Fantôme de ${d.cible} battu : +1 point, +1 boule ❄` : `${d.cible}'s ghost beaten: +1 point, +1 snowball ❄`; couleur = GLACE; }
  else if (d && d.gagne) { titre = fr ? `Battu à nouveau, mais cette version de ${d.cible} ne rapporte plus rien` : `Beaten again, but this version of ${d.cible} gives nothing more`; }
  else if (d) { titre = fr ? `Raté : ${d.cible} était à ${secondes(d.cible_ms)} s` : `Missed: ${d.cible} was at ${secondes(d.cible_ms, false)} s`; couleur = ROUGE; }
  useEffect(() => { const id = setTimeout(onDone, 7000); return () => clearTimeout(id); }, [onDone]);
  return (
    <motion.button onClick={onDone} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="w-full rounded-2xl border-2 px-3 py-2.5 text-center" style={{ borderColor: couleur }}>
      <div className="font-black text-sm" style={{ color: couleur }}>{titre}</div>
      {v.secoue > 0 && <div className="text-[11px] text-foreground/75">{fr ? `${v.secoue} boule${v.secoue > 1 ? 's' : ''} de neige secouée${v.secoue > 1 ? 's' : ''}.` : `${v.secoue} snowball${v.secoue > 1 ? 's' : ''} shaken off.`}</div>}
      {v.etoile_allumee && <div className="text-[11px]" style={{ color: OR }}>{fr ? 'Tu allumes l’étoile : tout le monde te chasse.' : 'You light the star: everyone is hunting you.'}</div>}
    </motion.button>
  );
}

/* ---------------------------------------------------------------- fil */

function Fil({ fil, fr }: { fil: FilNoel[]; fr: boolean }) {
  const phrase = (f: FilNoel) => {
    switch (f.genre) {
      case 'entree': return fr ? `${f.a} entre dans l’arène (${secondes(f.ms || 0)})` : `${f.a} enters the arena (${secondes(f.ms || 0, false)})`;
      case 'allume': return fr ? `★ ${f.a} allume l’étoile` : `★ ${f.a} lights the star`;
      case 'battu': return fr ? `${f.a} bat le fantôme de ${f.b}` : `${f.a} beats ${f.b}'s ghost`;
      case 'vol': return fr ? `★ ${f.a} vole l’étoile à ${f.b} !` : `★ ${f.a} steals the star from ${f.b}!`;
      case 'neige': return fr ? `❄ ${f.a} lance ${f.n} boule${(f.n || 0) > 1 ? 's' : ''} sur ${f.b}` : `❄ ${f.a} throws ${f.n} at ${f.b}`;
      case 'secoue': return fr ? `${f.a} recourt et secoue ${f.n} boule${(f.n || 0) > 1 ? 's' : ''}` : `${f.a} runs again and shakes off ${f.n}`;
      default: return '';
    }
  };
  const quand = (q: number) => new Date(q).toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="w-full flex flex-col gap-1">
      <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? 'Le fil de la bataille' : 'Battle feed'}</h3>
      {fil.slice(0, 15).map((f, i) => (
        <div key={i} className="text-xs flex gap-2"
             style={{ color: f.genre === 'vol' || f.genre === 'allume' ? OR : f.genre === 'neige' ? GLACE : undefined }}>
          <span className="text-muted-foreground tabular-nums shrink-0">{quand(f.quand)}</span>
          <span className="min-w-0">{phrase(f)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- classement */

function Classement({ t, fr }: { t: TableauNoel; fr: boolean }) {
  const moiKey = t.moi?.key;
  return (
    <div className="w-full flex flex-col gap-1">
      <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? 'Classement' : 'Standings'}</h3>
      {t.classement.slice(0, 20).map((l, i) => (
        <div key={l.key} className="flex items-center gap-2 text-xs px-2 py-1 rounded-lg"
             style={{ background: l.key === moiKey ? 'rgba(255,255,255,0.08)' : undefined }}>
          <span className="w-6 text-right tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="flex-1 min-w-0 truncate font-bold">{l.etoile ? '★ ' : ''}{l.name}</span>
          <span className="text-muted-foreground tabular-nums">{l.battus} 👻 · {duree(l.tenue_ms, fr)} ★</span>
          <span className="w-10 text-right font-black tabular-nums">{l.points}</span>
        </div>
      ))}
    </div>
  );
}

function Regles({ t, fr }: { t: TableauNoel; fr: boolean }) {
  const r = t.regles;
  const pct = (x: number) => (x * 100).toLocaleString(fr ? 'fr-FR' : 'en-GB', { maximumFractionDigits: 1 });
  return (
    <div className="w-full text-[10px] md:text-[11px] text-muted-foreground/90 leading-snug flex flex-col gap-1 px-1">
      {fr ? (<>
        <p><b>Ton fantôme, c’est ta dernière course</b>, pas ta meilleure. Chaque fantôme battu : 1 point et 1 boule de neige.</p>
        <p><b>❄ Une boule</b> ralentit le fantôme visé de {pct(r.neige_pct)} % pendant 24 h (jusqu’à {r.neige_max} boules). Il secoue la neige en recourant, mais son fantôme devient alors cette course-là.</p>
        <p><b>★ L’étoile</b> : une seule pour tout le jeu. Bats le fantôme de celui qui la tient pour la lui voler (+{r.vol_points} points). Elle pèse {pct(r.etoile_pct_h)} % de plus par heure tenue (jusqu’à {pct(r.etoile_max)} %), et rapporte 1 point par quart d’heure.</p>
      </>) : (<>
        <p><b>Your ghost is your latest run</b>, not your best. Each ghost beaten: 1 point and 1 snowball.</p>
        <p><b>❄ A snowball</b> slows the target ghost by {pct(r.neige_pct)}% for 24 h (up to {r.neige_max}). They shake it off by running again, but their ghost becomes that run.</p>
        <p><b>★ The star</b>: only one in the game. Beat the holder’s ghost to steal it (+{r.vol_points} points). It weighs {pct(r.etoile_pct_h)}% more per hour held (up to {pct(r.etoile_max)}%) and gives 1 point per quarter hour.</p>
      </>)}
    </div>
  );
}
