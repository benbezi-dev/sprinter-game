import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Crown, Ghost, RotateCcw, Swords, Vote, Trophy, Snowflake } from 'lucide-react';
import { MONTEE, useAnimationsReduites } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import { useRetour } from '@/hooks/use-retour';
import {
  fetchTableau, ecouterEq, voter, entrer, courir, courirDepartage, defier, secondes, EPREUVES_NOEL, NOM_EPREUVE,
  dernierVerdict, oublierVerdict,
  type TableauEq, type EquipeNoel, type VerdictEq, type FilEq,
} from '@/game/noel-equipes';

/* ---------------------------------------------------------------------------
   NOEL 2026 — LES QUATRE EQUIPES. Une vue par phase du calendrier :
   avant → vote des chefs → departage au 200 m → manches (et leurs
   eliminations) → vainqueur. Les regles : worker/src/noel-equipes.js.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const GLACE = '#bfe6ff';
const OR = '#ffd426';
export const COULEURS = ['#ff5a5a', '#4ade80', OR, GLACE];
const NOMS_COULEUR = { fr: ['Rouge', 'Vert', 'Or', 'Glace'], en: ['Red', 'Green', 'Gold', 'Ice'] };

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
const nomEquipe = (e: EquipeNoel, fr: boolean) => `${fr ? 'Équipe' : 'Team'} ${e.chef}`;

/** Ce que dit la banniere selon la phase. */
function resume(t: TableauEq, fr: boolean): { titre: string; ligne: string } {
  const C = t.calendrier;
  switch (t.phase) {
    case 'avant': return { titre: fr ? 'Noël : 4 équipes, une seule gagne' : 'Christmas: 4 teams, one winner',
      ligne: fr ? `Vote des chefs le ${date(C.vote, fr)}` : `Captain vote on ${date(C.vote, fr)}` };
    case 'vote': return { titre: fr ? 'Vote pour les 4 chefs d’équipe' : 'Vote for the 4 team captains',
      ligne: fr ? `Les 8 premiers du 60 m · clôture ${date(C.voteFin, fr)}` : `Top 8 of the 60 m · closes ${date(C.voteFin, fr)}` };
    case 'departage': return { titre: fr ? 'Égalité : départage au 200 m en salle' : 'Tie: 200 m indoor decider',
      ligne: (t.departage?.egalite || []).map(x => x.name).join(' · ') };
    case 'manche': {
      const tete = [...t.equipes].filter(e => e.eliminee == null).sort((a, b) => b.score - a.score)[0];
      return { titre: t.pause ? (fr ? 'Pause : championnat de France' : 'Break: French championship')
                              : (t.manche === 3 ? (fr ? 'FINALE de Noël' : 'Christmas FINAL') : (fr ? `Manche ${t.manche} sur 3` : `Round ${t.manche} of 3`)),
        ligne: tete ? (fr ? `En tête : ${nomEquipe(tete, fr)}, ${tete.score} pts` : `Leading: ${nomEquipe(tete, fr)}, ${tete.score} pts`) : '' };
    }
    default: return { titre: t.vainqueur ? (fr ? `${nomEquipe({ chef: t.vainqueur.chef } as EquipeNoel, fr)} gagne Noël !` : `${t.vainqueur.chef}'s team wins Christmas!`) : (fr ? 'Noël est fini' : 'Christmas is over'),
      ligne: fr ? 'Le palmarès des quatre équipes' : 'The four teams’ record' };
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
        <motion.span className="relative shrink-0"
          animate={reduit ? {} : { rotate: [0, 10, -10, 0] }}
          transition={reduit ? {} : { duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}>
          <Snowflake className="w-7 h-7" style={{ color: GLACE }} aria-hidden />
        </motion.span>
        <span className="relative flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 truncate">
            {fr ? 'Noël · 4 équipes · battle royale' : 'Christmas · 4 teams · battle royale'}
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
              {fr ? 'LES ÉQUIPES DE NOËL' : 'THE CHRISTMAS TEAMS'}
            </h2>
            <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide mt-1">
              {fr ? 'Épreuves en salle · points FFA · une équipe éliminée par manche' : 'Indoor events · FFA points · one team out per round'}
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
        <AnimatePresence>{verdict && <Verdict v={verdict} fr={fr} onDone={() => setVerdict(null)} />}</AnimatePresence>
        {message && <button onClick={() => setMessage(null)} className="w-full text-xs text-center rounded-xl border border-white/15 px-3 py-2">{message}</button>}

        {t && t.phase === 'avant' && <Calendrier t={t} fr={fr} />}
        {t && t.phase === 'vote' && <VueVote t={t} fr={fr} voter={k => agir(voter(k))} />}
        {t && t.phase === 'departage' && (
          <VueDepartage t={t} fr={fr} moiKey={(nom || '').trim().toLowerCase()} courir={() => partir(courirDepartage)} />
        )}
        {t && (t.phase === 'manche' || t.phase === 'fini') && (
          <VueManche t={t} fr={fr} nom={nom} enRoute={enRoute}
            courir={ep => partir(() => courir(ep))} attaquer={attaquer} entrer={() => agir(entrer())} />
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
        {fr ? `Les ${t.regles.candidats} premiers du 60 m sont candidats. Les ${t.regles.chefs} plus votés deviennent chefs. Une voix par appareil, tu peux changer d’avis jusqu’au ${date(t.calendrier.voteFin, fr)}.`
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
  courir: (epreuve: string) => void; attaquer: (k: string, epreuve: string) => void; entrer: () => void;
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
        <div className="w-full rounded-2xl border-2 px-3 py-3 text-center" style={{ borderColor: COULEURS[t.vainqueur.equipe] }}>
          <Trophy className="w-8 h-8 mx-auto" style={{ color: OR }} aria-hidden />
          <div className="font-black text-lg" style={{ color: COULEURS[t.vainqueur.equipe] }}>
            {fr ? `L’équipe ${t.vainqueur.chef} gagne Noël` : `${t.vainqueur.chef}'s team wins Christmas`}
          </div>
          <div className="text-xs text-muted-foreground">{fr ? `${t.vainqueur.points} points en finale` : `${t.vainqueur.points} points in the final`}</div>
        </div>
      )}
      {t.phase === 'manche' && (
        <div className="text-center">
          <div className="font-black" style={{ color: t.pause ? GLACE : OR }}>
            {t.pause ? (fr ? 'PAUSE : CHAMPIONNAT DE FRANCE, rien ne compte' : 'BREAK: FRENCH CHAMPIONSHIP, nothing counts')
                     : t.manche === 3 ? (fr ? 'FINALE' : 'FINAL') : (fr ? `MANCHE ${t.manche} SUR 3` : `ROUND ${t.manche} OF 3`)}
          </div>
          {fin && <div className="text-[10px] text-muted-foreground">
            {t.manche === 3 ? (fr ? `Vainqueur le ${date(fin, fr)}` : `Winner on ${date(fin, fr)}`)
                            : (fr ? `La dernière équipe sera éliminée le ${date(fin, fr)}` : `Last team out on ${date(fin, fr)}`)}
          </div>}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {tri.map(e => <CarteEquipe key={e.n} e={e} fr={fr} mienne={mienne?.n === e.n} />)}
      </div>

      {t.phase === 'manche' && (
        !nom ? <p className="text-xs text-center text-muted-foreground">{fr ? 'Choisis ton nom pour rejoindre une équipe.' : 'Pick your name to join a team.'}</p>
        : !moi ? (
          <button onClick={entrer} className="w-full rounded-xl py-3 font-black text-black" style={{ background: GLACE }}>
            {fr ? 'REJOINDRE UNE ÉQUIPE' : 'JOIN A TEAM'}
          </button>
        ) : (
          <>
            <p className="text-xs text-center text-foreground/80">
              {fr ? `Dans chaque épreuve, ton meilleur chrono du jour rapporte ses points FFA à ton équipe. Bats le fantôme d’un adversaire : +${t.regles.duel}. S’il te bat, son équipe prend +${t.regles.defense}.`
                  : `In each event, your best time of the day gives its FFA points to your team. Beat a rival's ghost: +${t.regles.duel}. If it beats you, its team takes +${t.regles.defense}.`}
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
              {fr ? `COURIR LE ${NOM_EPREUVE[epreuve].fr.toUpperCase()} POUR MON ÉQUIPE` : `RUN THE ${NOM_EPREUVE[epreuve].en.toUpperCase()} FOR MY TEAM`}
            </button>
            {proies.length > 0 && !t.pause && (
              <div className="w-full flex flex-col gap-1">
                <h3 className="text-[11px] font-black tracking-[0.2em] uppercase text-white/80">{fr ? `Fantômes à défier · ${NOM_EPREUVE[epreuve].fr}` : `Ghosts to challenge · ${NOM_EPREUVE[epreuve].en}`}</h3>
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
  const out = e.eliminee != null;
  return (
    <div className="rounded-2xl border-2 px-3 py-2 flex flex-col gap-0.5" style={{ borderColor: c, opacity: out ? 0.45 : 1, background: mienne ? c + '22' : undefined }}>
      <div className="flex items-center gap-1 text-[9px] font-black tracking-widest uppercase" style={{ color: c }}>
        {NOMS_COULEUR[fr ? 'fr' : 'en'][e.n]}{mienne && <span className="text-white/80">· {fr ? 'ton équipe' : 'your team'}</span>}
      </div>
      <div className="font-black truncate flex items-center gap-1"><Crown className="w-3.5 h-3.5 shrink-0" style={{ color: OR }} aria-hidden />{e.chef}</div>
      <div className="flex items-baseline justify-between">
        <span className="font-display font-black text-2xl tabular-nums">{out ? '—' : e.score}</span>
        <span className="text-[10px] text-muted-foreground">{e.effectif} {fr ? 'joueurs' : 'players'}</span>
      </div>
      {out && <div className="text-[10px] font-black" style={{ color: c }}>{fr ? `ÉLIMINÉE (manche ${e.eliminee})` : `OUT (round ${e.eliminee})`}</div>}
    </div>
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
    sous = v.gain ? (fr ? `+${v.gain} pour ton équipe` : `+${v.gain} for your team`) : (fr ? 'Pas mieux que ton meilleur du jour' : 'Not better than your best today');
    const d = v.duel;
    if (d && d.compte) sous += d.gagne ? (fr ? ` · fantôme de ${d.cible} battu, +${d.points}` : ` · ${d.cible}'s ghost beaten, +${d.points}`)
                                       : (fr ? ` · le fantôme de ${d.cible} gagne, son équipe prend +${-d.points}` : ` · ${d.cible}'s ghost wins, their team takes +${-d.points}`);
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
      case 'eliminee': return fr ? `✖ L’équipe ${f.a} est éliminée` : `✖ ${f.a}'s team is out`;
      case 'vainqueur': return fr ? `🏆 L’équipe ${f.a} gagne Noël` : `🏆 ${f.a}'s team wins Christmas`;
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
    [C.vote, fr ? 'Vote des chefs (8 premiers du 60 m)' : 'Captain vote (top 8 of the 60 m)'],
    [C.voteFin, fr ? 'Départage au 200 m en salle si égalité' : 'Indoor 200 m decider if tied'],
    [C.departageFin, fr ? 'Les équipes s’ouvrent · manche 1' : 'Teams open · round 1'],
    [C.manches[0].fin, fr ? '1ʳᵉ élimination · manche 2' : '1st elimination · round 2'],
    [C.pause.debut, fr ? 'Pause : championnat de France' : 'Break: French championship'],
    [C.manches[1].fin, fr ? '2ᵉ élimination · finale' : '2nd elimination · final'],
    [C.manches[2].fin, fr ? 'Vainqueur de Noël' : 'Christmas winner'],
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
