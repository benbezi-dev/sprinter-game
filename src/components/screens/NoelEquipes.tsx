import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Crown, Ghost, RotateCcw, Swords, Vote, Trophy, BookOpen, ChevronRight } from 'lucide-react';
import { MONTEE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { useRetour } from '@/hooks/use-retour';
import {
  fetchTableau, ecouterEq, voter, entrer, courir, courirDepartage, defier, secondes, EPREUVES_NOEL, NOM_EPREUVE,
  dernierVerdict, oublierVerdict,
  type TableauEq, type EquipeNoel, type VerdictEq, type FilEq,
} from '@/game/noel-equipes';
import { CLANS, clanDe, LEGENDE, MOMENTS, HEROS, PAROLES, RENCONTRE, urlBanniere, type Ligne } from '@/game/noel-clans';

/* ---------------------------------------------------------------------------
   NOEL 2026 — LES QUATRE EQUIPES. Une vue par phase du calendrier :
   avant → vote des chefs → departage au 200 m → manches (et leurs
   eliminations) → vainqueur. Les regles : worker/src/noel-equipes.js.

   L'HISTOIRE : LA TREVE DES QUATRE CLANS (game/noel-clans.ts, docs/NOEL_CLANS.md).
   Les quatre equipes sont quatre clans du Grand Nord — les Braises, les Sapins, les
   Etoiles, les Givres —, chacun avec sa banniere et sa devise ; chaque etape du
   calendrier a son recit. Les regles ne changent pas : seule la facon de les dire.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const GLACE = '#bfe6ff';
const OR = '#ffd426';
export const COULEURS = ['#ff5a5a', '#4ade80', OR, GLACE];
const L = (l: Ligne, fr: boolean) => (fr ? l[0] : l[1]);

/** Le moment de l'histoire qui correspond a l'etat du tableau. */
function momentDe(t: TableauEq): keyof typeof MOMENTS {
  if (t.phase === 'manche') return t.pause ? 'pause' : t.manche === 3 ? 'finale' : t.manche === 2 ? 'manche2' : 'manche1';
  return t.phase;
}

function useFr() { return SprinterApp.N.getLang() === 'fr'; }

function useTableau() {
  const [t, setT] = useState<TableauEq | null>(null);
  const [erreur, setErreur] = useState(false);
  const relire = useCallback(async () => {
    try { setT(await fetchTableau()); setErreur(false); } catch { setErreur(true); }
  }, []);
  useEffect(() => {
    relire();
    const id = setInterval(relire, 30_000);
    const off = ecouterEq(relire);
    return () => { clearInterval(id); off(); };
  }, [relire]);
  return { t, erreur, relire };
}

const date = (ms: number, fr: boolean) => new Date(ms).toLocaleString(fr ? 'fr-FR' : 'en-GB',
  { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
const nomEquipe = (e: { n: number; chef: string }, fr: boolean) => `${L(clanDe(e.n).nom, fr)} (${e.chef})`;

/** Ce que dit la banniere selon la phase. */
function resume(t: TableauEq, fr: boolean): { titre: string; ligne: string } {
  const C = t.calendrier;
  const m = MOMENTS[momentDe(t)];
  switch (t.phase) {
    case 'avant': return { titre: L(m.titre, fr),
      ligne: fr ? `L’Appel des Champions le ${date(C.vote, fr)}` : `Call of Champions on ${date(C.vote, fr)}` };
    case 'vote': return { titre: L(m.titre, fr),
      ligne: fr ? `Élis les 4 champions · clôture ${date(C.voteFin, fr)}` : `Elect the 4 champions · closes ${date(C.voteFin, fr)}` };
    case 'departage': return { titre: L(m.titre, fr),
      ligne: (t.departage?.egalite || []).map(x => x.name).join(' · ') };
    case 'manche': {
      const tete = [...t.equipes].filter(e => e.eliminee == null).sort((a, b) => b.score - a.score)[0];
      return { titre: L(m.titre, fr),
        ligne: tete ? (fr ? `En tête : ${nomEquipe(tete, fr)}, ${tete.score} pts` : `Leading: ${nomEquipe(tete, fr)}, ${tete.score} pts`) : L(m.ligne, fr) };
    }
    default: return { titre: t.vainqueur ? L(clanDe(t.vainqueur.equipe).sacre, fr).split('.')[0] : L(m.titre, fr),
      ligne: L(m.ligne, fr) };
  }
}

let rouvrirAuRetour = false;

/* ============================================================== la banniere */

export function BanderoleNoelEquipes() {
  const fr = useFr();
  const reduit = useAnimationsReduites();
  const [ouvert, setOuvert] = useState(rouvrirAuRetour);
  useEffect(() => { rouvrirAuRetour = false; }, []);
  const { t } = useTableau();
  const r = t ? resume(t, fr) : null;
  return (
    <motion.div {...MONTEE}>
      <motion.button onClick={() => setOuvert(true)} whileTap={{ scale: 0.98 }}
        className="relative w-full rounded-2xl border-2 overflow-hidden flex items-center gap-3 px-3 py-2.5 text-left"
        style={{ borderColor: GLACE, background: 'linear-gradient(100deg, rgba(255,90,90,0.16), rgba(74,222,128,0.12), rgba(255,212,38,0.14))' }}>
        <span className="relative shrink-0 flex -space-x-3" aria-hidden>
          {CLANS.map((k, i) => (
            <motion.img key={k.cle} src={urlBanniere(k.n, fr)} alt="" className="w-6 h-9 drop-shadow"
              animate={reduit ? {} : { rotate: [0, i % 2 ? 6 : -6, 0] }}
              transition={reduit ? {} : { duration: 2.6, delay: i * 0.3, repeat: Infinity, ease: 'easeInOut' }} />
          ))}
        </span>
        <span className="relative flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 truncate">
            {fr ? 'Noël · la Trêve des 4 clans' : 'Christmas · the Truce of the 4 clans'}
          </span>
          <span className="font-black text-sm md:text-base leading-tight truncate">{r ? r.titre : '…'}</span>
          <span className="text-[10px] md:text-xs text-foreground/70 leading-snug truncate">{r ? r.ligne : ''}</span>
        </span>
        <span className="relative shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest" style={{ background: GLACE }}>
          {fr ? 'ENTRER' : 'ENTER'}
        </span>
      </motion.button>
      <AnimatePresence>
        {ouvert && <EcranNoelEquipes onClose={() => setOuvert(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ============================================================== l'ecran */

export function EcranNoelEquipes({ onClose }: { onClose: () => void }) {
  useRetour(onClose);
  const fr = useFr();
  const { t, erreur, relire } = useTableau();
  const [verdict, setVerdict] = useState<VerdictEq | null>(dernierVerdict);
  const [message, setMessage] = useState<string | null>(null);
  const [enRoute, setEnRoute] = useState<string | null>(null);
  // la legende s'ouvre d'elle-meme a la premiere visite
  const [legende, setLegende] = useState(() => { try { return !localStorage.getItem('sprinter_legende_treve'); } catch { return false; } });
  useEffect(() => { try { localStorage.setItem('sprinter_legende_treve', '1'); } catch { /* */ } }, []);
  useEffect(() => { oublierVerdict(); }, []);
  const nom = getSavedName();

  const partir = (f: () => void) => { rouvrirAuRetour = true; onClose(); f(); };
  const attaquer = async (cible: string, epreuve: string) => {
    if (enRoute) return;
    setEnRoute(cible);
    const ok = await defier(cible, epreuve);
    setEnRoute(null);
    if (ok) { rouvrirAuRetour = true; onClose(); } else setMessage(fr ? 'Ce fantôme ne répond pas.' : 'This ghost is not answering.');
  };
  const agir = async (p: Promise<{ ok: boolean; error?: string }>) => {
    const r = await p;
    if (!r.ok) setMessage(r.error || 'erreur');
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-20 flex flex-col items-center gap-4">
        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 className="font-display font-black text-2xl md:text-3xl leading-none" style={{ color: GLACE }}>
              {fr ? 'LA TRÊVE DES QUATRE CLANS' : 'THE TRUCE OF THE FOUR CLANS'}
            </h2>
            <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide mt-1">
              {fr ? 'Épreuves en salle · points FFA · un clan éteint sa torche à chaque manche' : 'Indoor events · FFA points · one clan puts out its torch each round'}
            </span>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors shrink-0">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        <LesBannieres t={t} fr={fr} />
        {t && (
          <div className="w-full text-center flex flex-col gap-1">
            <div className="font-display font-black text-lg" style={{ color: OR }}>{L(MOMENTS[momentDe(t)].titre, fr)}</div>
            <p className="text-xs text-foreground/80 leading-snug">{L(MOMENTS[momentDe(t)].ligne, fr)}</p>
          </div>
        )}
        {t && <MotDesHeros moment={!t.moi && t.phase === 'manche' ? 'tirage' : momentDe(t)} fr={fr} />}
        <button onClick={() => setLegende(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl border text-[11px] font-black tracking-widest"
          style={{ borderColor: OR + '88', color: OR }}>
          <BookOpen className="w-4 h-4" aria-hidden /> {fr ? 'LA LÉGENDE DE LA TRÊVE' : 'THE LEGEND OF THE TRUCE'}
        </button>
        <AnimatePresence>{legende && <Legende fr={fr} onClose={() => setLegende(false)} />}</AnimatePresence>

        {!t && !erreur && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-8" aria-hidden />}
        {erreur && !t && (
          <button onClick={relire} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card/80 border border-white/10 text-sm">
            <RotateCcw className="w-4 h-4" aria-hidden /> {fr ? 'Le tableau ne répond pas. Réessayer' : 'The board is not answering. Try again'}
          </button>
        )}
        <AnimatePresence>{verdict && <Verdict v={verdict} fr={fr} onDone={() => setVerdict(null)} />}</AnimatePresence>
        {message && <button onClick={() => setMessage(null)} className="w-full text-xs text-center rounded-xl border border-white/15 px-3 py-2">{message}</button>}

        {t && t.phase === 'avant' && <Calendrier t={t} fr={fr} />}
        {t && t.phase === 'vote' && <VueVote t={t} fr={fr} voter={k => agir(voter(k))} />}
        {t && t.phase === 'departage' && (
          <VueDepartage t={t} fr={fr} moiKey={(nom || '').trim().toLowerCase()} courir={() => partir(courirDepartage)} />
        )}
        {t && (t.phase === 'manche' || t.phase === 'fini') && (
          <VueManche t={t} fr={fr} nom={nom} enRoute={enRoute}
            courir={ep => partir(() => courir(ep))} attaquer={attaquer} entrer={n => agir(entrer(n))} />
        )}
        {t && t.phase !== 'avant' && t.phase !== 'vote' && <Calendrier t={t} fr={fr} />}
      </div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- vote */

function VueVote({ t, fr, voter }: { t: TableauEq; fr: boolean; voter: (k: string) => void }) {
  const max = Math.max(1, ...t.candidats.map(c => c.voix));
  return (
    <div className="w-full flex flex-col gap-2">
      <p className="text-xs text-foreground/80 text-center">
        {fr ? `Les ${t.regles.candidats} premiers du 60 m se présentent. Les ${t.regles.chefs} plus votés deviennent les champions des quatre clans. Une voix par appareil, tu peux changer d’avis jusqu’au ${date(t.calendrier.voteFin, fr)}.`
            : `The top ${t.regles.candidats} of the 60 m are candidates. The ${t.regles.chefs} most voted become captains. One vote per device, you can change it until ${date(t.calendrier.voteFin, fr)}.`}
      </p>
      {t.candidats.map(c => {
        const mien = t.mon_vote === c.key;
        return (
          <button key={c.key} onClick={() => voter(c.key)}
            className="relative w-full rounded-xl border-2 px-3 py-2 flex items-center gap-3 text-left overflow-hidden"
            style={{ borderColor: mien ? OR : 'rgba(255,255,255,0.12)' }}>
            <span className="absolute inset-y-0 left-0 opacity-20" style={{ width: `${(c.voix / max) * 100}%`, background: OR }} />
            <span className="relative w-6 text-center font-black tabular-nums text-muted-foreground">{c.rang}</span>
            <span className="relative flex-1 min-w-0">
              <span className="font-black truncate block">{c.name}</span>
              <span className="text-[10px] text-muted-foreground">{secondes(c.ms, fr)} s</span>
            </span>
            <span className="relative font-black tabular-nums">{c.voix}</span>
            <span className="relative text-[10px] font-black px-2 py-1 rounded-lg" style={{ background: mien ? OR : 'rgba(255,255,255,0.1)', color: mien ? 'black' : undefined }}>
              {mien ? (fr ? 'TA VOIX' : 'YOUR VOTE') : (<span className="flex items-center gap-1"><Vote className="w-3 h-3" aria-hidden />{fr ? 'VOTER' : 'VOTE'}</span>)}
            </span>
          </button>
        );
      })}
      {!t.candidats.length && <p className="text-xs text-muted-foreground text-center">{fr ? 'Pas encore de candidats.' : 'No candidates yet.'}</p>}
    </div>
  );
}

/* ---------------------------------------------------------------- departage */

function VueDepartage({ t, fr, moiKey, courir }: { t: TableauEq; fr: boolean; moiKey: string; courir: () => void }) {
  const d = t.departage;
  if (!d) return null;
  const jeSuis = d.egalite.some(x => x.key === moiKey);
  return (
    <div className="w-full flex flex-col gap-2">
      <p className="text-xs text-foreground/80 text-center">
        {fr ? `Égalité de voix : ${d.places} place${d.places > 1 ? 's' : ''} de chef pour ${d.egalite.length}. Le meilleur 200 m en salle avant le ${date(t.calendrier.departageFin, fr)} l’emporte.`
            : `Tied votes: ${d.places} captain seat${d.places > 1 ? 's' : ''} for ${d.egalite.length}. The best indoor 200 m before ${date(t.calendrier.departageFin, fr)} wins.`}
      </p>
      {[...d.egalite].sort((a, b) => (a.ms ?? Infinity) - (b.ms ?? Infinity)).map(x => (
        <div key={x.key} className="w-full rounded-xl border border-white/12 px-3 py-2 flex items-center justify-between">
          <span className="font-black">{x.name}</span>
          <span className="tabular-nums text-sm">{x.ms != null ? `${secondes(x.ms, fr)} s` : (fr ? 'pas encore couru' : 'not run yet')}</span>
        </div>
      ))}
      {jeSuis && (
        <button onClick={courir} className="w-full rounded-xl py-3 font-black text-black" style={{ background: OR }}>
          {fr ? 'COURIR LE 200 M' : 'RUN THE 200 M'}
        </button>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------- manches */

function VueManche({ t, fr, nom, enRoute, courir, attaquer, entrer }: {
  t: TableauEq; fr: boolean; nom: string | null; enRoute: string | null;
  courir: (epreuve: string) => void; attaquer: (k: string, epreuve: string) => void; entrer: (n: number) => void;
}) {
  const [epreuve, setEpreuve] = useState<string>(EPREUVES_NOEL[0]);
  const moi = t.moi;
  const mienne = moi ? t.equipes.find(e => e.n === moi.equipe) : null;
  const actives = t.equipes.filter(e => e.eliminee == null);
  const tri = [...t.equipes].sort((a, b) => (a.eliminee == null ? 0 : 1) - (b.eliminee == null ? 0 : 1) || b.score - a.score);
  // Les fantomes a defier : les joueurs des autres equipes actives qui ont couru l'epreuve choisie.
  const proies = t.phase === 'manche' && moi
    ? actives.filter(e => e.n !== moi.equipe).flatMap(e => e.membres.filter(m => m.fantomes[epreuve] != null)
        .map(m => ({ ...m, ms: m.fantomes[epreuve], equipe: e.n })))
        .sort((a, b) => a.ms - b.ms)
    : [];
  const fin = t.manche ? t.calendrier.manches.find(m => m.n === t.manche)?.fin : null;

  return (
    <div className="w-full flex flex-col gap-3">
      {t.vainqueur && (
        <div className="w-full rounded-2xl border-2 px-3 py-3 text-center flex flex-col items-center gap-1" style={{ borderColor: COULEURS[t.vainqueur.equipe] }}>
          <img src={urlBanniere(t.vainqueur.equipe, fr)} alt="" className="w-16 h-24" />
          <Trophy className="w-6 h-6" style={{ color: OR }} aria-hidden />
          <div className="font-black text-lg" style={{ color: COULEURS[t.vainqueur.equipe] }}>
            {fr ? `${L(clanDe(t.vainqueur.equipe).nom, fr)} gagnent Noël` : `${L(clanDe(t.vainqueur.equipe).nom, fr)} win Christmas`}
          </div>
          <div className="text-xs text-foreground/80">{L(clanDe(t.vainqueur.equipe).sacre, fr)}</div>
          <div className="text-xs text-muted-foreground">{fr ? `${t.vainqueur.points} points en finale` : `${t.vainqueur.points} points in the final`}</div>
        </div>
      )}
      {t.phase === 'manche' && (
        <div className="text-center">
          <div className="font-black" style={{ color: t.pause ? GLACE : OR }}>
            {t.pause ? (fr ? 'TRÊVE DU SOLSTICE : championnat de France, rien ne compte' : 'SOLSTICE TRUCE: French championship, nothing counts')
                     : t.manche === 3 ? (fr ? 'FINALE' : 'FINAL') : (fr ? `MANCHE ${t.manche} SUR 3` : `ROUND ${t.manche} OF 3`)}
          </div>
          {fin && <div className="text-[10px] text-muted-foreground">
            {t.manche === 3 ? (fr ? `Vainqueur le ${date(fin, fr)}` : `Winner on ${date(fin, fr)}`)
                            : (fr ? `Le dernier clan éteindra sa torche le ${date(fin, fr)}` : `The last clan puts out its torch on ${date(fin, fr)}`)}
          </div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {tri.map(e => <CarteEquipe key={e.n} e={e} fr={fr} mienne={mienne?.n === e.n} />)}
      </div>

      {t.phase === 'manche' && (
        !nom ? <p className="text-xs text-center text-muted-foreground">{fr ? 'Choisis ton nom pour entrer dans la Trêve.' : 'Pick your name to join the Truce.'}</p>
        : !moi ? (
          <ChoixDuClan t={t} fr={fr} entrer={entrer} />
        ) : (
          <>
            <MonClan n={moi.equipe} fr={fr} />
            <p className="text-xs text-center text-foreground/80">
              {fr ? `Dans chaque épreuve, ton meilleur chrono du jour est ton offrande : ses points FFA vont à ton clan. Bats le fantôme d’un champion adverse : +${t.regles.duel}. S’il te bat, son clan prend +${t.regles.defense}.`
                  : `In each event, your best time of the day is your offering: its FFA points go to your clan. Beat a rival champion's ghost: +${t.regles.duel}. If it beats you, their clan takes +${t.regles.defense}.`}
            </p>
            <div className="grid grid-cols-4 gap-1" role="tablist">
              {EPREUVES_NOEL.map(ep => (
                <button key={ep} role="tab" aria-selected={ep === epreuve} onClick={() => setEpreuve(ep)}
                  className="rounded-lg py-2 text-[11px] font-black border"
                  style={ep === epreuve ? { background: COULEURS[moi.equipe], color: 'black', borderColor: COULEURS[moi.equipe] } : { borderColor: 'rgba(255,255,255,0.15)' }}>
                  {NOM_EPREUVE[ep][fr ? 'fr' : 'en']}
                </button>
              ))}
            </div>
            <button onClick={() => courir(epreuve)} disabled={t.pause} className="w-full rounded-xl py-3 font-black text-black disabled:opacity-40"
                    style={{ background: COULEURS[moi.equipe] }}>
              {fr ? `COURIR LE ${NOM_EPREUVE[epreuve].fr.toUpperCase()} POUR ${L(clanDe(moi.equipe).nom, fr).toUpperCase()}` : `RUN THE ${NOM_EPREUVE[epreuve].en.toUpperCase()} FOR ${L(clanDe(moi.equipe).nom, fr).toUpperCase()}`}
            </button>
            {proies.length > 0 && !t.pause && (
              <div className="w-full flex flex-col gap-1">
                <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? `Duels de champions · ${NOM_EPREUVE[epreuve].fr}` : `Champions’ duels · ${NOM_EPREUVE[epreuve].en}`}</h3>
                <p className="text-[10px] text-muted-foreground -mt-0.5">{fr ? 'Même absent, ton ombre défend ton clan.' : 'Even when you’re away, your shadow defends your clan.'}</p>
                {proies.slice(0, 20).map(p => (
                  <button key={p.key} onClick={() => attaquer(p.key, epreuve)} disabled={!!enRoute}
                    className="w-full rounded-xl border px-3 py-2 flex items-center gap-2 text-left"
                    style={{ borderColor: COULEURS[p.equipe] + '88' }}>
                    <Ghost className="w-4 h-4 shrink-0" style={{ color: COULEURS[p.equipe] }} aria-hidden />
                    <span className="flex-1 font-bold truncate">{p.name}{p.chef ? ' 👑' : ''}</span>
                    <span className="tabular-nums text-sm">{secondes(p.ms, fr)} s</span>
                    {enRoute === p.key ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Swords className="w-4 h-4" aria-hidden />}
                  </button>
                ))}
              </div>
            )}
          </>
        )
      )}
      <Fil fil={t.fil} equipes={t.equipes} fr={fr} />
    </div>
  );
}

function CarteEquipe({ e, fr, mienne }: { e: EquipeNoel; fr: boolean; mienne: boolean }) {
  const c = COULEURS[e.n];
  const k = clanDe(e.n);
  const out = e.eliminee != null;
  return (
    <div className="rounded-2xl border-2 px-2 py-2 flex gap-2" style={{ borderColor: c, opacity: out ? 0.45 : 1, background: mienne ? c + '22' : undefined }}>
      <img src={urlBanniere(e.n, fr)} alt="" className="w-10 h-[3.75rem] shrink-0" style={{ filter: out ? 'grayscale(1)' : undefined }} />
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center gap-1 text-[9px] font-black tracking-widest uppercase truncate" style={{ color: c }}>
          {L(k.nom, fr)}{mienne && <span className="text-white/80">· {fr ? 'ton clan' : 'your clan'}</span>}
        </div>
        <div className="font-black truncate flex items-center gap-1 text-sm"><Crown className="w-3.5 h-3.5 shrink-0" style={{ color: OR }} aria-hidden />{e.chef}</div>
        <div className="flex items-baseline justify-between">
          <span className="font-display font-black text-2xl tabular-nums">{out ? '—' : e.score}</span>
          <span className="text-[10px] text-muted-foreground">{e.effectif} {fr ? 'coureurs' : 'runners'}</span>
        </div>
        {out && <div className="text-[10px] font-black leading-tight" style={{ color: c }}>{fr ? `TORCHE ÉTEINTE (manche ${e.eliminee})` : `TORCH OUT (round ${e.eliminee})`}</div>}
      </div>
    </div>
  );
}

/** Les quatre bannieres cote a cote, chacune avec sa devise ; celles des clans eteints, en gris. */
function LesBannieres({ t, fr }: { t: TableauEq | null; fr: boolean }) {
  const reduit = useAnimationsReduites();
  return (
    <div className="w-full grid grid-cols-4 gap-2">
      {CLANS.map((k, i) => {
        const e = t?.equipes.find(x => x.n === k.n);
        const out = e?.eliminee != null;
        return (
          <div key={k.cle} className="flex flex-col items-center text-center gap-0.5">
            <motion.img src={urlBanniere(k.n, fr)} alt={L(k.clan, fr)} className="w-full max-w-[5.5rem] drop-shadow-lg"
              style={{ filter: out ? 'grayscale(1) brightness(0.6)' : undefined }}
              animate={reduit || out ? {} : { rotate: [0, i % 2 ? 2.5 : -2.5, 0] }}
              transition={reduit || out ? {} : { duration: 3.2, delay: i * 0.4, repeat: Infinity, ease: 'easeInOut' }} />
            <span className="text-[9px] italic leading-tight text-white/70">« {L(k.devise, fr)} »</span>
            {e && <span className="text-[9px] font-black truncate max-w-full" style={{ color: k.couleur }}>{L(k.champion, fr)} : {e.chef}</span>}
          </div>
        );
      })}
    </div>
  );
}

/**
 * LE SERMENT DE LA BANNIERE : le joueur choisit son clan parmi les actifs, et ce choix est
 * DEFINITIF (l'auteur, 28/11 ; worker/src/noel-equipes.js, entrer). Une confirmation
 * avant l'envoi : on ne change plus de banniere jusqu'a Noel.
 */
function ChoixDuClan({ t, fr, entrer }: { t: TableauEq; fr: boolean; entrer: (n: number) => void }) {
  const [vise, setVise] = useState<number | null>(null);
  const actives = t.equipes.filter(e => e.eliminee == null);
  const k = vise !== null ? clanDe(vise) : null;
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="text-center">
        <div className="font-display font-black text-base" style={{ color: OR }}>{L(MOMENTS.tirage.titre, fr)}</div>
        <p className="text-xs text-foreground/80 leading-snug">{L(MOMENTS.tirage.ligne, fr)}</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {actives.map(e => {
          const c = clanDe(e.n);
          return (
            <motion.button key={e.n} onClick={() => setVise(e.n)} whileTap={{ scale: 0.97 }}
              className="rounded-2xl border-2 p-2 flex flex-col items-center text-center gap-1"
              style={{ borderColor: vise === e.n ? c.couleur : c.couleur + '55', background: vise === e.n ? c.couleur + '26' : c.couleur + '0d' }}>
              <img src={urlBanniere(e.n, fr)} alt="" className="w-16 h-24" />
              <span className="font-black text-sm leading-tight" style={{ color: c.couleur }}>{L(c.nom, fr)}</span>
              <span className="text-[10px] italic text-white/75 leading-tight">« {L(c.devise, fr)} »</span>
              <span className="text-[10px] text-white/60 leading-tight">{L(c.vertu, fr)}</span>
              <span className="text-[10px] font-bold text-white/70">{L(c.champion, fr)} : {e.chef} · {e.effectif} {fr ? 'coureurs' : 'runners'}</span>
            </motion.button>
          );
        })}
      </div>
      {/* dans un portail : l'ecran est un conteneur anime qui defile, et un « fixed » pose dedans
          suivait son defilement — la confirmation sortait coupee en haut */}
      {createPortal(<AnimatePresence>
        {k && vise !== null && (
          <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setVise(null)}>
            <motion.div onClick={ev => ev.stopPropagation()} initial={{ y: 16 }} animate={{ y: 0 }}
              className="w-full max-w-sm rounded-2xl border-2 p-5 flex flex-col items-center text-center gap-2"
              style={{ borderColor: k.couleur, background: 'linear-gradient(170deg, #1a2550, #0c1229)' }}>
              <img src={urlBanniere(vise, fr)} alt="" className="w-20 h-[7.5rem]" />
              <div className="font-display font-black text-xl" style={{ color: k.couleur }}>{L(k.clan, fr)}</div>
              <p className="text-sm text-white/85 leading-snug">
                {fr ? `Tu jures fidélité à la bannière des ${L(k.nom, fr).replace(/^Les /, '')}. Ce choix est définitif : tu ne pourras plus changer de clan jusqu’à Noël.`
                    : `You swear loyalty to the banner of ${L(k.nom, fr)}. This choice is final: you cannot change clans until Christmas.`}
              </p>
              <p className="text-[11px] text-white/55 leading-snug">
                {fr ? 'Seule exception : si ton clan éteint sa torche, son feu passe dans les autres, et toi avec.'
                    : 'One exception: if your clan puts out its torch, its fire passes to the others, and you with it.'}
              </p>
              <button onClick={() => { const n = vise; setVise(null); entrer(n); }}
                className="w-full rounded-xl py-3 font-black text-black mt-1" style={{ background: k.couleur }}>
                {fr ? `JE JURE : ${L(k.cri, fr).toUpperCase()}` : `I SWEAR: ${L(k.cri, fr).toUpperCase()}`}
              </button>
              <button onClick={() => setVise(null)} className="text-xs text-white/60 underline">
                {fr ? 'Je réfléchis encore' : 'Let me think again'}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>, document.body)}
    </div>
  );
}

/** Ton clan : sa banniere, sa vertu, son cri. */
function MonClan({ n, fr }: { n: number; fr: boolean }) {
  const k = clanDe(n);
  return (
    <div className="w-full rounded-2xl border-2 px-3 py-2 flex items-center gap-3" style={{ borderColor: k.couleur, background: k.couleur + '18' }}>
      <img src={urlBanniere(n, fr)} alt="" className="w-12 h-[4.5rem] shrink-0" />
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-[9px] font-black tracking-[0.2em] uppercase text-white/70">{fr ? 'Ta bannière, jusqu’à Noël' : 'Your banner, until Christmas'}</span>
        <span className="font-black text-base leading-tight" style={{ color: k.couleur }}>{L(k.clan, fr)}</span>
        <span className="text-[11px] text-foreground/80 leading-snug">{L(k.vertu, fr)}</span>
        <span className="text-[11px] font-black mt-0.5" style={{ color: k.couleur }}>{L(k.cri, fr)}</span>
      </div>
    </div>
  );
}

/** Le mot des trois heros sur le moment de la Treve : le Pere Noel, Sonny, Frost. */
function MotDesHeros({ moment, fr }: { moment: keyof typeof PAROLES; fr: boolean }) {
  const paroles = PAROLES[moment];
  return (
    <div className="w-full flex flex-col gap-1.5">
      {HEROS.map((h, i) => (
        <motion.div key={h.cle} initial={{ opacity: 0, x: i % 2 ? 12 : -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 * i }}
          className={`flex items-end gap-2 ${i % 2 ? 'flex-row-reverse text-right' : ''}`}>
          <img src={`${BASE}/${h.portrait}`} alt={L(h.nom, fr)} className="w-11 h-11 rounded-full object-cover shrink-0 border-2"
               style={{ borderColor: h.couleur, background: '#0c1229' }} />
          <div className="flex-1 min-w-0 rounded-2xl px-3 py-1.5 border" style={{ borderColor: h.couleur + '66', background: h.couleur + '14' }}>
            <span className="block text-[9px] font-black tracking-[0.15em] uppercase" style={{ color: h.couleur }}>
              {L(h.nom, fr)} · {L(h.role, fr)}
            </span>
            <span className="block text-[12px] leading-snug text-white/90">{L(paroles[i], fr)}</span>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

/** La legende de la Treve, page a page ; puis les heros, et comment Sonny et Frost sont devenus amis. */
function Legende({ fr, onClose }: { fr: boolean; onClose: () => void }) {
  const [p, setP] = useState(0);
  const pages = LEGENDE.pages;
  const total = pages.length + 2;
  const derniere = p >= total - 1;
  const pageHeros = p === pages.length, pageRencontre = p === pages.length + 1;
  return (
    <motion.div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4 overflow-y-auto"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div key={p} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-2xl border p-5 flex flex-col gap-3 my-auto"
        style={{ borderColor: OR, background: 'linear-gradient(170deg, #1a2550, #0c1229)' }}>
        <span className="text-[10px] font-bold tracking-[0.3em]" style={{ color: GLACE }}>
          {pageHeros || pageRencontre ? (fr ? 'LES HÉROS DE LA TRÊVE' : 'HEROES OF THE TRUCE') : (fr ? 'LA LÉGENDE' : 'THE LEGEND')}
        </span>
        <h3 className="font-display font-black text-xl leading-tight" style={{ color: OR }}>
          {pageHeros ? (fr ? 'TOUJOURS AUX CÔTÉS DU PÈRE NOËL' : 'ALWAYS BY SANTA’S SIDE')
            : pageRencontre ? (fr ? 'SONNY ET FROST' : 'SONNY AND FROST') : L(LEGENDE.titre, fr)}
        </h3>
        {p === 0 && (
          <div className="grid grid-cols-4 gap-2">
            {CLANS.map(k => <img key={k.cle} src={urlBanniere(k.n, fr)} alt={L(k.clan, fr)} className="w-full" />)}
          </div>
        )}
        {pageHeros ? (
          <div className="flex flex-col gap-3">
            {HEROS.map((h, i) => (
              <motion.div key={h.cle} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.3 }} className="flex gap-3">
                <img src={`${BASE}/${h.portrait}`} alt="" className="w-16 h-16 rounded-full object-cover shrink-0 border-2" style={{ borderColor: h.couleur, background: '#0c1229' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-black leading-tight" style={{ color: h.couleur }}>{L(h.nom, fr)}</div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-white/60">{L(h.role, fr)}</div>
                  <p className="text-[13px] leading-snug text-white/90 mt-0.5">{L(h.portraitTexte, fr)}</p>
                  <p className="text-[12px] leading-snug italic text-white/65 mt-0.5">{L(h.travers, fr)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {pageRencontre && (
              <div className="flex justify-center gap-3 mb-1">
                {HEROS.filter(h => h.cle !== 'pere-noel').map(h => (
                  <img key={h.cle} src={`${BASE}/${h.portrait}`} alt={L(h.nom, fr)} className="w-20 h-20 rounded-full object-cover border-2" style={{ borderColor: h.couleur, background: '#0c1229' }} />
                ))}
              </div>
            )}
            {(pageRencontre ? RENCONTRE : pages[p]).map((l, i) => (
              <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.3 }}
                className="text-[15px] leading-snug text-white/90">{L(l, fr)}</motion.p>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between pt-1">
          <span className="text-[10px] text-white/45 tabular-nums">{p + 1}/{total}</span>
          <button onClick={() => (derniere ? onClose() : setP(p + 1))}
            className="flex items-center gap-1 px-4 py-2 rounded-xl font-black text-xs tracking-widest text-black" style={{ background: OR }}>
            {derniere ? (fr ? 'ENTRER DANS LA TRÊVE' : 'JOIN THE TRUCE') : (fr ? 'SUITE' : 'NEXT')} <ChevronRight className="w-4 h-4" aria-hidden />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- verdict, fil, calendrier */

function Verdict({ v, fr, onDone }: { v: VerdictEq; fr: boolean; onDone: () => void }) {
  useEffect(() => { const id = setTimeout(onDone, 7000); return () => clearTimeout(id); }, [onDone]);
  let titre: string, sous = '', couleur = 'white';
  if (v.error) { titre = fr ? `Course non comptée : ${v.error}` : `Run not counted: ${v.error}`; couleur = COULEURS[0]; }
  else if (v.departage) { titre = fr ? `200 m : ${secondes(v.ms)} s` : `200 m: ${secondes(v.ms, false)} s`; sous = fr ? `Ton meilleur : ${secondes(v.meilleur || v.ms)} s` : `Your best: ${secondes(v.meilleur || v.ms, false)} s`; couleur = OR; }
  else {
    const ep = v.epreuve && NOM_EPREUVE[v.epreuve] ? `${NOM_EPREUVE[v.epreuve][fr ? 'fr' : 'en']} · ` : '';
    titre = ep + (v.niveau ? `${secondes(v.ms, fr)} s · ${v.niveau} (${v.ffa} pts)` : `${secondes(v.ms, fr)} s · ${fr ? 'hors barème' : 'off the table'}`);
    sous = v.gain ? (fr ? `+${v.gain} pour ton clan` : `+${v.gain} for your clan`) : (fr ? 'Pas mieux que ton meilleur du jour' : 'Not better than your best today');
    const d = v.duel;
    if (d && d.compte) sous += d.gagne ? (fr ? ` · fantôme de ${d.cible} battu, +${d.points}` : ` · ${d.cible}'s ghost beaten, +${d.points}`)
                                       : (fr ? ` · le fantôme de ${d.cible} gagne, son clan prend +${-d.points}` : ` · ${d.cible}'s ghost wins, their clan takes +${-d.points}`);
    else if (d) sous += fr ? ` · duel contre ${d.cible} déjà joué aujourd’hui` : ` · already raced ${d.cible} today`;
    couleur = OR;
  }
  return (
    <motion.button onClick={onDone} initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="w-full rounded-2xl border-2 px-3 py-2.5 text-center" style={{ borderColor: couleur }}>
      <div className="font-black text-sm" style={{ color: couleur }}>{titre}</div>
      {sous && <div className="text-[11px] text-foreground/75">{sous}</div>}
    </motion.button>
  );
}

function Fil({ fil, equipes, fr }: { fil: FilEq[]; equipes: EquipeNoel[]; fr: boolean }) {
  if (!fil.length) return null;
  const eq = (n: number) => equipes.find(e => e.n === n);
  const phrase = (f: FilEq) => {
    const ep = f.epreuve && NOM_EPREUVE[f.epreuve] ? ` · ${NOM_EPREUVE[f.epreuve][fr ? 'fr' : 'en']}` : '';
    return base(f) + (f.genre === 'ffa' || f.genre === 'duel' || f.genre === 'defense' ? ep : '');
  };
  const base = (f: FilEq) => {
    switch (f.genre) {
      case 'ffa': return fr ? `${f.a} : ${f.b} (+${f.points})` : `${f.a}: ${f.b} (+${f.points})`;
      case 'duel': return fr ? `${f.a} bat le fantôme de ${f.b} (+${f.points})` : `${f.a} beats ${f.b}'s ghost (+${f.points})`;
      case 'defense': return fr ? `Le fantôme de ${f.a} résiste à ${f.b} (+${f.points})` : `${f.a}'s ghost holds off ${f.b} (+${f.points})`;
      case 'eliminee': return `✖ ${L(clanDe(f.equipe).extinction, fr)}`;
      case 'vainqueur': return `🏆 ${L(clanDe(f.equipe).sacre, fr)}`;
      default: return '';
    }
  };
  const quand = (q: number) => new Date(q).toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
  return (
    <div className="w-full flex flex-col gap-1">
      <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? 'Le fil' : 'Feed'}</h3>
      {fil.slice(0, 15).map((f, i) => (
        <div key={i} className="text-xs flex gap-2">
          <span className="text-muted-foreground tabular-nums shrink-0">{quand(f.quand)}</span>
          <span style={{ color: eq(f.equipe) ? COULEURS[f.equipe] : undefined }}>{phrase(f)}</span>
        </div>
      ))}
    </div>
  );
}

function Calendrier({ t, fr }: { t: TableauEq; fr: boolean }) {
  const C = t.calendrier;
  const lignes: [number, string][] = [
    [C.vote, fr ? 'L’Appel des Champions : vote parmi les 8 premiers du 60 m' : 'Call of Champions: vote among the top 8 of the 60 m'],
    [C.voteFin, fr ? 'Le Duel des Prétendants : 200 m en salle si égalité' : 'Contenders’ Duel: indoor 200 m if tied'],
    [C.departageFin, fr ? 'Le Serment de la Bannière · le Feu des Premières Neiges (manche 1)' : 'Oath of the Banner · Fire of the First Snow (round 1)'],
    [C.manches[0].fin, fr ? 'Un clan éteint sa torche · la Longue Nuit (manche 2)' : 'A clan puts out its torch · the Long Night (round 2)'],
    [C.pause.debut, fr ? 'La Trêve du Solstice : championnat de France' : 'Solstice Truce: French championship'],
    [C.manches[1].fin, fr ? 'Un second clan s’éteint · la Course de l’Étoile (finale)' : 'A second clan goes out · the Star Race (final)'],
    [C.manches[2].fin, fr ? 'L’Étoile s’allume : le clan vainqueur partage la flamme' : 'The Star is lit: the winning clan shares the flame'],
  ];
  return (
    <div className="w-full flex flex-col gap-1 rounded-2xl border border-white/10 px-3 py-2">
      <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? 'Le calendrier' : 'Schedule'}</h3>
      {lignes.map(([q, l]) => (
        <div key={q} className="text-xs flex gap-2" style={{ opacity: q <= t.maintenant ? 0.45 : 1 }}>
          <span className="text-muted-foreground tabular-nums shrink-0 w-28">{date(q, fr)}</span><span>{l}</span>
        </div>
      ))}
    </div>
  );
}
