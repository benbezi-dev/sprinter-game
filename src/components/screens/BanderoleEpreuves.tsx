// LE DUEL DES EPREUVES (08/11/2026) : 60, 200 ou 400 m en salle, quelle epreuve
// pour le Championnat de France du 19/12 ? 1 course finie en salle = 1 voix,
// 10 par jour au plus. Les regles et les dates vivent dans
// worker/src/duel-epreuves.js : la banderole ne s'affiche que si le serveur
// dit le duel ouvert, il n'y a donc pas de date a tenir ici.
//
// LES FANTOMES ET L'ECRAN (11/11, demande de l'auteur : « un menu comme pour la
// bataille des marques ») : la banderole de l'accueil ouvre un ecran plein —
// le score, les regles, tes voix, le fantome a ta mesure, les fantomes les plus
// charges a abattre (Kin compris) et le fil des voix tombees. Rouvert tout seul
// en revenant d'une course partie d'ici, verdict en tete.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Ghost, Crosshair, Vote, Swords } from 'lucide-react';
import { MONTEE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getDeviceId, getSavedName } from '@/game/leaderboard';
import { defier, dernierVerdict, oublierVerdict, type VerdictEpreuves } from '@/game/duel-epreuves';
import { useRetour } from '@/hooks/use-retour';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const EPREUVES = ['60', '200s', '400s'] as const;
type Epreuve = typeof EPREUVES[number];
const NOM: Record<Epreuve, string> = { '60': '60 m', '200s': '200 m', '400s': '400 m' };

type Fantome = { name: string; cible: string; ms: number; a_battre_ms: number; voix: number };
type Tableau = {
  ouvert: boolean; fin: number;
  epreuves: Record<Epreuve, { voix: number; joueurs: number }>;
  en_tete: Epreuve | null;
  /** La premiere et toute epreuve a moins de 5 % d'elle : on les court toutes. */
  retenues?: Epreuve[];
  voix_par_jour: number; mes_voix_du_jour: number;
  annulees_par_victoire?: number;
  fil?: { qui: string; cible: string; epreuve: Epreuve; annulees: number; at: number }[];
  fantomes?: Record<Epreuve, Fantome[]>;
};

function lire(): Promise<Tableau | null> {
  return fetch(`${API_BASE}/duel-epreuves?device_id=${encodeURIComponent(getDeviceId())}`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
}

function useTableau() {
  const [t, setT] = useState<Tableau | null>(null);
  // relu a chaque montage et chaque minute
  useEffect(() => {
    let vivant = true;
    const maj = () => lire().then(d => { if (vivant && d) setT(d); });
    maj();
    const id = window.setInterval(maj, 60_000);
    return () => { vivant = false; window.clearInterval(id); };
  }, []);
  return t;
}

/** « 12 j 4 h », ou « 3 h 05 » le dernier jour. */
function reste(ms: number, fr: boolean): string {
  const h = Math.floor(ms / 3600_000), j = Math.floor(h / 24);
  if (j >= 1) return fr ? `${j} j ${h % 24} h` : `${j}d ${h % 24}h`;
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h} h ${String(m).padStart(2, '0')}`;
}
const sec = (ms: number, fr: boolean) => { const x = (ms / 1000).toFixed(2); return fr ? x.replace('.', ',') : x; };

// Une course partie de l'ecran le rouvre au retour a l'accueil.
let rouvrirAuRetour = false;

export function BanderoleEpreuves() {
  const fr = SprinterApp.N.getLang() === 'fr';
  const t = useTableau();
  const [ouvert, setOuvert] = useState(rouvrirAuRetour);
  useEffect(() => { rouvrirAuRetour = false; }, []);
  const reduit = useAnimationsReduites();
  if (!t || !t.ouvert) return null;
  const vivant = !reduit;

  return (
    <motion.div {...MONTEE} className="w-full">
      <motion.button onClick={() => setOuvert(true)} whileTap={{ scale: 0.98 }}
        className="relative w-full rounded-2xl border-2 border-primary/60 bg-card overflow-hidden flex items-center gap-3 px-3 py-2.5 text-left">
        <motion.div aria-hidden className="absolute inset-0 rounded-2xl border-2 border-primary pointer-events-none"
          animate={vivant ? { opacity: [0.2, 0.9, 0.2] } : { opacity: 0.5 }}
          transition={vivant ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0 }} />
        <motion.span className="relative shrink-0"
          animate={vivant ? { rotate: [0, -14, 12, 0, 0], scale: [1, 1.2, 1.08, 1, 1] } : {}}
          transition={vivant ? { duration: 3, times: [0, 0.06, 0.12, 0.22, 1], repeat: Infinity } : { duration: 0 }}>
          <Ghost className="w-7 h-7 text-primary" aria-hidden />
        </motion.span>
        <span className="relative flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 truncate">
            {fr ? `Champ. de France 19/12 · fin ${reste(Math.max(0, t.fin - Date.now()), fr)}`
                : `French Champs 19/12 · ends ${reste(Math.max(0, t.fin - Date.now()), fr)}`}
          </span>
          <span className="font-display font-black text-sm md:text-base leading-tight whitespace-nowrap">
            60 <span className="text-foreground/50">vs</span> 200 <span className="text-foreground/50">vs</span> 400
          </span>
          <span className="text-[10px] text-foreground/70 truncate">
            {fr ? `1 course = 1 voix · fantôme battu : −${t.annulees_par_victoire ?? 3}` : `1 race = 1 vote · ghost beaten: −${t.annulees_par_victoire ?? 3}`}
          </span>
        </span>
        <motion.span className="relative shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest bg-white"
          animate={vivant ? { scale: [1, 1.08, 1, 1.05, 1, 1] } : {}}
          transition={vivant ? { duration: 1.6, times: [0, 0.08, 0.18, 0.26, 0.4, 1], repeat: Infinity } : { duration: 0 }}>
          {fr ? 'JOUER' : 'PLAY'}
        </motion.span>
      </motion.button>
      {/* hors de la banderole : sa transformation enfermerait l'ecran sous la bulle du tchat */}
      {createPortal(
        <AnimatePresence>
          {ouvert && <EcranEpreuves premier={t} onClose={() => setOuvert(false)} />}
        </AnimatePresence>, document.body)}
    </motion.div>
  );
}

function EcranEpreuves({ premier, onClose }: { premier: Tableau; onClose: () => void }) {
  useRetour(onClose);
  const fr = SprinterApp.N.getLang() === 'fr';
  const t = useTableau() || premier;
  const [verdict] = useState<VerdictEpreuves | null>(() => { const v = dernierVerdict; oublierVerdict(); return v; });
  const [enRoute, setEnRoute] = useState<string | null>(null);
  const [aucun, setAucun] = useState<string | null>(null);
  const [vue, setVue] = useState<Epreuve>((verdict?.epreuve as Epreuve) || t.en_tete || '200s');
  const n = t.annulees_par_victoire ?? 3;
  const retenues = t.retenues ?? (t.en_tete ? [t.en_tete] : []);
  const total = EPREUVES.reduce((s, e) => s + t.epreuves[e].voix, 0);
  const moi = getSavedName().trim().toLowerCase();

  const courir = (e: Epreuve) => { rouvrirAuRetour = true; onClose(); SprinterApp.startOneShot([e] as any, { levelIdx: 4 }); };
  const attaquer = async (e: Epreuve, cible?: string) => {
    const cle = e + (cible || '');
    if (enRoute) return;
    setEnRoute(cle); setAucun(null);
    const ok = await defier(e, cible);
    setEnRoute(null);
    if (ok) { rouvrirAuRetour = true; onClose(); } else setAucun(cle);
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-[61] bg-background/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-20 flex flex-col gap-4">
        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-primary">
              {fr ? 'Championnat de France · 19/12 · salle Jesse Owens' : 'French Championship · 19/12 · Jesse Owens hall'}
            </span>
            <h2 className="font-display font-black text-2xl leading-tight">{fr ? 'QUELLE ÉPREUVE ?' : 'WHICH EVENT?'}</h2>
            <span className="text-[10px] text-muted-foreground">
              {fr ? `Fin du vote dans ${reste(Math.max(0, t.fin - Date.now()), fr)}` : `Vote ends in ${reste(Math.max(0, t.fin - Date.now()), fr)}`}
            </span>
          </div>
          <button onClick={onClose} aria-label={fr ? 'Fermer' : 'Close'}
            className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors shrink-0">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {verdict?.duel && (
          <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className={`rounded-2xl border-2 px-3 py-2.5 ${verdict.duel.gagne ? 'border-primary bg-primary/15' : 'border-white/20 bg-card'}`}>
            <span className={`font-black text-sm ${verdict.duel.gagne ? 'text-primary' : ''}`}>
              {verdict.duel.gagne
                ? (verdict.duel.notee
                  ? (fr ? `FANTÔME DE ${verdict.duel.cible.toUpperCase()} BATTU : −${verdict.duel.annulees} VOIX AU ${NOM[verdict.epreuve as Epreuve]}`
                        : `${verdict.duel.cible.toUpperCase()}'S GHOST BEATEN: −${verdict.duel.annulees} VOTES ON THE ${NOM[verdict.epreuve as Epreuve]}`)
                  : (fr ? 'Fantôme battu, mais tes 10 attaques du jour sont faites.' : 'Ghost beaten, but your 10 attacks today are used.'))
                : (fr ? `Raté de ${sec(verdict.ms - verdict.duel.cible_ms, fr)} s contre ${verdict.duel.cible} : ta course a voté ${NOM[verdict.epreuve as Epreuve]}.`
                      : `Missed ${verdict.duel.cible} by ${sec(verdict.ms - verdict.duel.cible_ms, fr)} s: your race voted ${NOM[verdict.epreuve as Epreuve]}.`)}
            </span>
          </motion.div>
        )}

        {/* le score */}
        <div className="flex flex-col gap-1.5">
          {EPREUVES.map(e => {
            const v = t.epreuves[e].voix;
            const part = total ? Math.round((v / total) * 100) : 0;
            const tete = retenues.includes(e);
            return (
              <div key={e} className="relative w-full h-11 rounded-xl overflow-hidden border border-white/15">
                <motion.div aria-hidden className={`absolute inset-y-0 left-0 ${tete ? 'bg-primary/45' : 'bg-white/15'}`}
                  initial={{ width: 0 }} animate={{ width: `${part}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
                <span className="relative h-full px-3 flex items-center justify-between gap-2">
                  <span className={`font-black ${tete ? 'text-primary' : ''}`}>
                    {NOM[e]}{tete ? (retenues.length > 1 ? (fr ? ' · à égalité' : ' · tied') : (fr ? ' · en tête' : ' · leading')) : ''}
                  </span>
                  <span className="text-xs font-bold tabular-nums">{v} {fr ? 'voix' : 'votes'} · {part} %</span>
                </span>
              </div>
            );
          })}
          {retenues.length > 1 && (
            <span className="text-[10px] font-bold text-primary">
              {fr ? 'Moins de 5 % d’écart : si ça tient, on court les deux le 19/12.' : 'Under 5% apart: if it holds, both are raced on 19/12.'}
            </span>
          )}
        </div>

        <p className="text-[11px] text-muted-foreground leading-snug">
          {fr
            ? `Chaque course en salle vote pour son épreuve (10 par jour). Bats le fantôme d’un joueur : il perd ${n} voix — mais raté, ta course vote pour son épreuve. Plus un fantôme tient de voix, plus il ralentit (+0,1 % par voix) : personne n’est à l’abri, même les plus rapides.`
            : `Every indoor race votes for its event (10 a day). Beat a player's ghost: they lose ${n} votes — miss, and your race votes for their event. The more votes a ghost holds, the slower it runs (+0.1% per vote): nobody is safe, not even the fastest.`}
        </p>
        <span className="text-[11px] font-bold">
          {t.mes_voix_du_jour < t.voix_par_jour
            ? (fr ? `Tes voix aujourd’hui : ${t.mes_voix_du_jour}/${t.voix_par_jour}` : `Your votes today: ${t.mes_voix_du_jour}/${t.voix_par_jour}`)
            : (fr ? `Tes ${t.voix_par_jour} voix du jour sont données. Reviens demain !` : `All ${t.voix_par_jour} votes used today. Come back tomorrow!`)}
        </span>

        {/* l'epreuve regardee : voter, le fantome a ta mesure, les plus charges */}
        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-card/60 border border-white/5">
          {EPREUVES.map(e => (
            <button key={e} onClick={() => setVue(e)}
              className={`py-1.5 rounded-lg text-[11px] font-black tracking-widest transition-colors ${vue === e ? 'bg-white/10 text-foreground' : 'text-foreground/50 hover:bg-white/5'}`}>
              {NOM[e]}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => courir(vue)}
            className="h-12 rounded-xl bg-white text-black font-black text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform">
            <Vote className="w-4 h-4" aria-hidden /> {fr ? `VOTER ${NOM[vue]}` : `VOTE ${NOM[vue]}`}
          </button>
          <button onClick={() => attaquer(vue)} disabled={!!enRoute}
            className="h-12 rounded-xl border-2 border-primary text-primary font-black text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform disabled:opacity-60">
            {enRoute === vue ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Crosshair className="w-4 h-4" aria-hidden />}
            {aucun === vue ? (fr ? 'AUCUN FANTÔME' : 'NO GHOST') : (fr ? `FANTÔME −${n}` : `GHOST −${n}`)}
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/80">
            {fr ? `Les plus chargés du ${NOM[vue]}` : `Most loaded on the ${NOM[vue]}`}
          </span>
          {(t.fantomes?.[vue] || []).length === 0 && (
            <span className="text-[11px] text-muted-foreground">
              {fr ? 'Pas encore de fantôme ici : la première course en dépose un.' : 'No ghost here yet: the first race leaves one.'}
            </span>
          )}
          {(t.fantomes?.[vue] || []).map(f => {
            const cle = vue + f.cible;
            const c = f.cible === moi;
            return (
              <div key={f.cible} className="flex items-center gap-2 h-11 px-3 rounded-xl bg-card/70 border border-white/10">
                <Ghost className="w-4 h-4 text-primary shrink-0" aria-hidden />
                <span className="flex-1 min-w-0 flex flex-col">
                  <span className="font-black text-sm truncate">{f.name}{c ? (fr ? ' (toi)' : ' (you)') : ''}</span>
                  <span className="text-[10px] text-muted-foreground tabular-nums">
                    {f.voix} {fr ? 'voix' : 'votes'} · {fr ? 'record' : 'best'} {sec(f.ms, fr)} s · {fr ? 'à battre' : 'to beat'} {sec(f.a_battre_ms, fr)} s
                  </span>
                </span>
                {!c && (
                  <button onClick={() => attaquer(vue, f.cible)} disabled={!!enRoute}
                    aria-label={fr ? `Défier le fantôme de ${f.name}` : `Race ${f.name}'s ghost`}
                    className="shrink-0 px-2.5 py-1.5 rounded-lg border border-primary/70 text-primary text-[10px] font-black flex items-center gap-1 disabled:opacity-50">
                    {enRoute === cle ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden /> : <Swords className="w-3 h-3" aria-hidden />}
                    {aucun === cle ? (fr ? 'PARTI' : 'GONE') : `−${Math.min(n, f.voix)}`}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {t.fil && t.fil.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/80">{fr ? 'Les voix qui tombent' : 'Votes going down'}</span>
            {t.fil.map((l, i) => (
              <span key={i} className="text-[11px] text-foreground/85">
                {fr ? <><b>{l.qui}</b> a battu <b>{l.cible}</b> : −{l.annulees} au {NOM[l.epreuve]}</>
                    : <><b>{l.qui}</b> beat <b>{l.cible}</b>: −{l.annulees} on the {NOM[l.epreuve]}</>}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
