import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';
import { Ghost, Loader2, Copy, Check, MessageCircle, MessageSquare, Share2, Globe2, Swords, Radio, RotateCcw } from 'lucide-react';
import {
  getSavedName, saveName, qualifyingRaces, submitRaceRecord, NO_RUN_MS,
  type RaceKey, type RaceOutcome,
} from '@/game/leaderboard';
import { primeTopNames } from '@/game/engine';
import {
  createChallenge, submitAttempt, challengeLink,
  shareText, whatsappUrl, smsUrl, canNativeShare, nativeShare,
} from '@/game/challenge';
import { DuelRanking } from './DuelRanking';
import { nomDuRang } from '@/components/Insignes';
import { pique } from '@/game/piques';
import { LaisserUnMot } from './MotDuel';
import type { DuelIssue } from '@/game/duels';
import { DUELS_OUVERTS } from '@/game/duels';
import { verrouDeReprise, fauxDepartEstUneDefaite } from '@/game/reprise';

/**
 * Chrono envoye au serveur apres une elimination au faux depart. Le duel se
 * tranche en comparant deux totaux : un abandon doit perdre, et cette marque
 * — la meme qui signale ailleurs une ligne sans course derriere elle — le dit
 * sans ajouter de colonne. C'est aussi la borne haute que le serveur accepte :
 * au-dela il rejette l'envoi, et le duel resterait ouvert alors qu'il est
 * bel et bien perdu.
 */
const DSQ_MS = NO_RUN_MS;

/** Chrono ou abandon, sans jamais appeler toFixed sur un null. */
function fmt(v: number | null | undefined, dnf: string) {
  return v == null ? dnf : `${v.toFixed(2)} s`;
}

export function OneShotEndScreen() {
  const { runTime, runSplits, shotRaces, ghostName, ghostTime, challenge, falseOut,
          liveOn, liveNom, liveResultat } = useGameStore();
  const { N, RACES } = SprinterApp;

  const [name, setName] = useState(getSavedName());
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(false);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [sent, setSent] = useState(false);
  // Retient le defi deja envoye, pas un simple booleen : si l'ecran survit
  // au passage d'un defi au suivant, un booleen bloquerait le second envoi.
  const submitted = useRef<string | null>(null);
  // Issue du duel telle que le serveur l'a tranchee. Elle ne depend pas du
  // chrono affiche ici : c'est lui qui fait foi, et il ne se rejoue pas.
  const [duel, setDuel] = useState<DuelIssue | null>(null);
  const [duelEnCours, setDuelEnCours] = useState(!!challenge);
  const [voirDuels, setVoirDuels] = useState(false);
  // La phrase de resultat ne se joue qu'une fois par defi.
  const sonne = useRef(false);

  // Les chronos d'un one shot ou d'un defi valent ceux de la carriere : un
  // 100 m reste un 100 m. On les propose donc au TOP 500, epreuve par epreuve
  // dans la categorie PAR COURSE, et seulement ceux qui y entrent vraiment.
  const [outcomes, setOutcomes] = useState<RaceOutcome[] | null>(null);
  const [topName, setTopName] = useState(getSavedName());
  const [topStatus, setTopStatus] = useState<'checking' | 'idle' | 'sending' | 'done' | 'error'>('checking');

  useEffect(() => {
    let cancelled = false;
    qualifyingRaces(shotRaces as RaceKey[], runSplits)
      .then(list => {
        if (cancelled) return;
        setOutcomes(list);
        const aEnvoyer = list.filter(o => o.beatsOwn);
        if (!aEnvoyer.length) { setTopStatus('done'); return; }
        // Nom deja connu : on enregistre sans rien demander. Un chrono qui
        // ameliore son propre record n'a aucune raison d'attendre un clic,
        // et c'est deja ce que fait la carriere.
        const nom = getSavedName().trim();
        if (nom) envoyer(nom, aEnvoyer);
        else setTopStatus('idle');
      })
      .catch(() => { if (!cancelled) { setOutcomes([]); setTopStatus('error'); } });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const envoyer = async (nom: string, liste: RaceOutcome[]) => {
    saveName(nom);
    setTopStatus('sending');
    try {
      for (const t of liste) await submitRaceRecord(t.race, nom, t.ms);
      primeTopNames();          // le plateau olympique se met a jour
      setTopStatus('done');
    } catch {
      setTopStatus('error');
    }
  };

  // Seuls les chronos qui ameliorent le record personnel sont envoyes : le
  // serveur ecarterait les autres de toute facon.
  const tops = (outcomes || []).filter(o => o.beatsOwn);
  const kept = (outcomes || []).filter(o => !o.beatsOwn);

  const handleSaveTop = () => {
    const finalName = topName.trim();
    if (!finalName || !tops.length) return;
    envoyer(finalName, tops);
  };

  const cible = SprinterApp.G.challengeTarget as { scoreId: number; name: string } | null;

  // Message envoye a l'ami : chrono realise, code, lien direct.
  const msg = code ? shareText(code, shotRaces, runTime * 1000, N.getLang() === 'fr') : '';

  const ghostSplits: number[] = (SprinterApp.G.ghostSplits || []) as number[];
  const complete = runSplits.length === shotRaces.length && runSplits.every(s => s != null);
  const beaten = !!challenge && complete && runTime < ghostTime;

  // Defi en cours : on envoie le resultat une seule fois, des l'arrivee.
  // Un faux depart eliminatoire s'envoie aussi — c'est une defaite, pas une
  // course qui n'a pas eu lieu, et l'adversaire doit toucher ses points.
  useEffect(() => {
    if (!challenge || submitted.current === challenge.id || (!complete && !falseOut)) return;
    submitted.current = challenge.id;
    setDuel(null); setDuelEnCours(true); sonne.current = false;
    submitAttempt({
      id: challenge.id,
      totalMs: falseOut ? DSQ_MS : runTime * 1000,
      splits: falseOut ? [] : runSplits.map(s => (s || 0) * 1000),
      name: getSavedName() || undefined,
    })
      .then(r => { setSent(true); setDuel(r.duel || null); })
      .catch(() => { /* le chrono local reste affiche */ })
      .finally(() => setDuelEnCours(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [challenge && challenge.id, complete, falseOut]);

  // La musique du resultat. Elle ne part qu'une fois l'issue connue : jouer
  // une fanfare avant de savoir qui a gagne serait pire que le silence.
  // Apres un faux depart la phrase de defaite a deja retenti pendant la
  // cinematique, on ne la rejoue pas.
  useEffect(() => {
    if (!duel || sonne.current || falseOut) return;
    sonne.current = true;
    SprinterApp.Audio_.cue(duel.issue === 'opponent' ? 'fanfare'
                         : duel.issue === 'draw' ? 'win' : 'dirge');
  }, [duel, falseOut]);

  const handleCreate = async () => {
    const finalName = name.trim();
    if (finalName) saveName(finalName);
    setBusy(true); setErr(false);
    try {
      const id = await createChallenge({
        races: shotRaces as ('100' | '200' | '400')[],
        levelIdx: SprinterApp.G.shotLevel,
        totalMs: runTime * 1000,
        splits: runSplits.map(s => (s || 0) * 1000),
        traces: SprinterApp.G.shotTraces || [],
        name: finalName || undefined,
        targetScoreId: SprinterApp.G.challengeTarget?.scoreId ?? null,
      });
      setCode(id);
    } catch {
      setErr(true);
    } finally {
      setBusy(false);
    }
  };

  // Le code se dicte, le lien s'envoie : les deux servent, on propose les deux.
  const handleCopy = async (what: 'code' | 'link') => {
    try {
      await navigator.clipboard.writeText(what === 'code' ? code : challengeLink(code));
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // presse-papiers refuse : le code reste lisible et recopiable a la main
    }
  };

  // Course en direct : l'issue vient de la salle, pas du chrono local — c'est
  // elle qui a vu les deux arrivees.
  const live = !!liveOn && !!liveResultat;
  const monRole = live && liveResultat.hote.id === liveResultat.moi ? 'hote' : 'invite';
  const liveGagne = live && (
    (monRole === 'hote' && liveResultat.issue === 'challenger') ||
    (monRole === 'invite' && liveResultat.issue === 'opponent'));
  const liveNul = live && liveResultat.issue === 'draw';
  const monMs = live ? liveResultat[monRole].ms : 0;
  const sonMs = live ? liveResultat[monRole === 'hote' ? 'invite' : 'hote'].ms : 0;

  // Ce qui interdit de rejouer, ou rien. `code` est l'identifiant du defi cree
  // depuis cette course : sa presence dit que le chrono est parti. `revanche`
  // marque une course lancee depuis un duel — elle survit a une reprise, sans
  // quoi il suffirait de rejouer une fois pour sortir de la chaine.
  const etatCourse = {
    defiRecu: !!challenge,
    defiEnvoye: !!code,
    fauxDepart: falseOut,
    chaineDeDuel: !!SprinterApp.G.revanche,
  };
  const verrou = verrouDeReprise(etatCourse);
  // Un faux depart ne fait perdre que s'il y a quelqu'un a qui perdre. Seul
  // sur la piste, il arrete la course et rien d'autre.
  const defaiteSeche = fauxDepartEstUneDefaite(etatCourse);

  const dnf = N.t('dnf_short');

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-black/90 backdrop-blur-md overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center max-w-2xl w-full py-6 md:py-8 gap-4 md:gap-6">

          <div className="flex flex-col items-center text-center gap-1 md:gap-2">
            {/* Titre en trois mots : tracking-tighter les collait en un seul
                bloc. On respire un peu et on garde le mot entier soude. */}
            <h1 className={`text-3xl sm:text-4xl md:text-6xl font-black font-display tracking-tight uppercase text-balance drop-shadow-[0_0_30px_rgba(248,205,74,0.35)]
              ${falseOut || (challenge && !beaten) || (live && !liveGagne && !liveNul)
                ? 'text-destructive' : live && liveGagne ? 'text-emerald-400' : 'text-primary'}`}>
              {falseOut ? N.t('false_out')
                : live ? N.t(liveGagne ? 'live_won' : liveNul ? 'live_tie' : 'live_lost')
                : challenge ? N.t(beaten ? 'challenge_won' : 'challenge_lost')
                : N.t('oneshot_done')}
            </h1>
            {falseOut ? (
              <div className="text-[10px] sm:text-xs md:text-base font-bold text-destructive tracking-widest uppercase">
                {N.t(defaiteSeche ? 'false_out_sub' : 'false_out_seul')}
              </div>
            ) : (
              <div className="text-[10px] sm:text-xs md:text-base font-medium text-foreground/80 tracking-widest uppercase">
                {N.t('total_in')}<span className="text-white font-bold ml-1 md:ml-2">{runTime.toFixed(2)} s</span>
              </div>
            )}
            {challenge && !falseOut && (
              <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest text-cyan-300 uppercase">
                {N.t('challenge_gap', { s: (Math.abs(runTime - ghostTime)).toFixed(2) })}
              </div>
            )}
          </div>

          {/* Course en direct : les deux chronos face a face. Le classement des
              duels est alimente par la salle elle-meme, donc rien a envoyer
              d'ici — seulement a montrer. */}
          {live && (
            <motion.div
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className={`w-full rounded-2xl border px-4 py-4 flex flex-col items-center gap-2 shadow-2xl
                ${liveGagne ? 'border-emerald-400/50 bg-emerald-400/[0.10]'
                  : liveNul ? 'border-white/20 bg-white/5'
                  : 'border-destructive/50 bg-destructive/10'}`}
            >
              <div className="flex items-center gap-2">
                <Radio className={`w-4 h-4 ${liveGagne ? 'text-emerald-400' : liveNul ? 'text-foreground' : 'text-destructive'}`} />
                <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-muted-foreground">
                  {N.t('live_vs', { n: liveNom || N.t('ghost_label') })}
                </span>
              </div>
              <div className="w-full rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5">
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs md:text-sm font-bold tracking-wide text-primary">{N.t('duel_you')}</span>
                  <span className={`font-mono font-bold text-sm md:text-base ${liveGagne ? 'text-emerald-400' : 'text-foreground'}`}>
                    {(monMs / 1000).toFixed(2)} s
                  </span>
                </div>
                <div className="flex items-center justify-between px-3 py-2">
                  <span className="text-xs md:text-sm font-bold tracking-wide text-cyan-300 truncate min-w-0">
                    {liveNom || '—'}
                  </span>
                  <span className={`font-mono font-bold text-sm md:text-base ${liveGagne ? 'text-foreground' : 'text-destructive'}`}>
                    {(sonMs / 1000).toFixed(2)} s
                  </span>
                </div>
              </div>
              {!liveNul && (
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  {N.t('live_gap', { s: (Math.abs(monMs - sonMs) / 1000).toFixed(2) })}
                </span>
              )}
            </motion.div>
          )}

          {/* Resultat du duel : les points comptent pour le classement des
              duels, et une seule fois. On l'annonce comme definitif parce
              qu'il l'est — relancer le meme defi ne redistribue rien. */}
          {challenge && (duelEnCours || duel) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`w-full rounded-2xl border px-4 py-4 flex flex-col items-center gap-1.5 shadow-2xl
                ${!duel ? 'border-white/10 bg-card/60'
                  : duel.issue === 'opponent' ? 'border-primary/50 bg-primary/10'
                  : duel.issue === 'draw' ? 'border-white/20 bg-white/5'
                  : 'border-destructive/50 bg-destructive/10'}`}
            >
              <div className="flex items-center gap-2">
                <Swords className={`w-4 h-4 ${!duel ? 'text-muted-foreground'
                  : duel.issue === 'opponent' ? 'text-primary'
                  : duel.issue === 'draw' ? 'text-foreground' : 'text-destructive'}`} />
                <span className={`font-black font-display tracking-tight uppercase text-lg md:text-2xl
                  ${!duel ? 'text-muted-foreground'
                    : duel.issue === 'opponent' ? 'text-primary'
                    : duel.issue === 'draw' ? 'text-foreground' : 'text-destructive'}`}>
                  {!duel ? N.t('duel_await')
                    : N.t(duel.issue === 'opponent' ? 'duel_won'
                        : duel.issue === 'draw' ? 'duel_tie' : 'duel_lost')}
                </span>
              </div>

              {duel && (
                <>
                  {/* Un duel deja tranche ne redistribue rien : afficher un
                      « 0 PL » laisserait croire a un match nul. */}
                  {typeof duel.lp === 'number' && (
                    <div className="flex flex-col items-center gap-1">
                      <span className="font-mono font-black text-2xl md:text-3xl
                                       tabular-nums text-foreground">
                        {duel.lp > 0 ? '+' : ''}{duel.lp}
                        <span className="text-xs font-normal ml-1 text-muted-foreground">
                          {N.t('duel_lp')}
                        </span>
                      </span>
                      {/* Un changement de division est le seul moment ou le
                          classement se raconte tout seul. On ne le laisse pas
                          passer dans une ligne de chiffres. */}
                      {duel.rang && (duel.monte || duel.descend) && (
                        <span className={`text-[10px] md:text-xs font-bold tracking-widest
                          ${duel.monte ? 'text-emerald-400' : 'text-destructive'}`}>
                          {N.t(duel.monte ? 'duel_promu' : 'duel_relegue', {
                            r: nomDuRang(duel.rang.etage, duel.rang.division),
                          })}
                        </span>
                      )}
                    </div>
                  )}
                  {/* Gagne : le vainqueur est la, et l'autre est parti depuis
                      longtemps. C'est ici, et nulle part ailleurs, qu'il peut
                      lui laisser un mot.

                      Derriere le meme interrupteur que le classement des duels,
                      et pas seulement par prudence : le serveur refuse le depot
                      hors du canal de test. Sans cette condition, un joueur de
                      la vraie version verrait le champ, ecrirait sa phrase, et
                      recevrait un refus — on lui aurait promis quelque chose
                      qui n'existe pas encore. Les deux verrous s'ouvriront le
                      meme jour. */}
                  {DUELS_OUVERTS && duel.issue === 'opponent' && (
                    <LaisserUnMot duel={challenge.id}
                                  adversaire={challenge.owner_name || N.t('opponent')} />
                  )}

                  {/* Perdu : le mot de l'adversaire, et la revanche.
                      Un ecart de chronos est exact et froid ; c'est la phrase
                      qui donne envie de repartir, et le bouton qui le permet
                      dans la foulee. */}
                  {duel.issue === 'challenger' && (
                    <>
                      <p className="text-sm md:text-base text-foreground text-center leading-snug
                                    px-2 mt-0.5">
                        « {pique(challenge.id, challenge.owner_name)} »
                      </p>
                      <button
                        onClick={() => {
                          SprinterApp.G.revanche = challenge.owner_name;
                          SprinterApp.startOneShot(shotRaces as any, { levelIdx: SprinterApp.G.shotLevel });
                        }}
                        className="mt-1 px-5 py-2.5 rounded-xl font-black font-display tracking-widest
                                   text-background bg-primary hover:bg-primary/90 transition-colors
                                   flex flex-col items-center leading-tight text-sm"
                      >
                        {N.t('duel_revanche')}
                        <span className="font-sans font-normal text-[9px] tracking-normal opacity-70">
                          {N.t('duel_revanche_sub')}
                        </span>
                      </button>
                    </>
                  )}
                  <span className="text-[10px] md:text-xs text-muted-foreground tracking-wide text-center">
                    {N.t('duel_vs', { n: challenge.owner_name || N.t('ghost_label') })}
                    {' · '}
                    {N.t(duel.deja ? 'duel_seen' : 'duel_final')}
                  </span>
                </>
              )}
            </motion.div>
          )}

          {/* Chronos epreuve par epreuve, face au fantome si defi */}
          <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-8 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-3">
              {shotRaces.map((r, i) => {
                const mine = runSplits[i];
                const his = challenge ? ghostSplits[i] : undefined;
                const ahead = mine != null && his != null && mine < his;
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border border-white/5 bg-black/20 gap-2">
                    <span className="font-bold tracking-wide text-foreground text-sm md:text-base truncate">
                      {RACES[r].label}
                    </span>
                    <div className="flex items-center gap-3 md:gap-5 shrink-0">
                      {his != null && (
                        <span className="font-mono text-xs md:text-sm text-cyan-300/70">
                          {his.toFixed(2)} s
                        </span>
                      )}
                      <span className={`font-mono font-bold text-base md:text-lg
                        ${mine == null ? 'text-destructive' : his == null ? 'text-primary' : ahead ? 'text-emerald-400' : 'text-destructive'}`}>
                        {fmt(mine, dnf)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 md:mt-4 pt-3 md:pt-4 border-t border-white/10 flex justify-between items-center px-2 md:px-4 gap-2">
              <span className="font-bold tracking-widest text-foreground uppercase text-sm md:text-base">
                {challenge ? N.t('you_label') : 'TOTAL'}
              </span>
              <span className={`font-mono font-black text-xl md:text-2xl
                ${falseOut ? 'text-destructive' : 'text-primary'}`}>
                {falseOut ? dnf : `${runTime.toFixed(2)} s`}
              </span>
            </div>
            {challenge && (
              <div className="flex justify-between items-center px-2 md:px-4 gap-2 mt-1">
                <span className="font-bold tracking-widest text-cyan-300 uppercase text-sm md:text-base truncate flex items-center gap-2">
                  <Ghost className="w-4 h-4 shrink-0" />{ghostName || N.t('ghost_label')}
                </span>
                <span className="font-mono font-black text-xl md:text-2xl text-cyan-300">{ghostTime.toFixed(2)} s</span>
              </div>
            )}
          </div>

          {/* Inscription au TOP 500, epreuve par epreuve */}
          {(topStatus === 'checking' || (outcomes && outcomes.length > 0)) && (
            <div className="w-full bg-card/60 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl flex flex-col gap-3">
              <div className="flex items-center gap-2 justify-center">
                <Globe2 className="w-4 h-4 text-primary" />
                <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">{N.t('top500')}</h2>
              </div>

              {topStatus === 'checking' && (
                <p className="text-center text-xs text-muted-foreground animate-pulse">
                  {N.t('os_top_checking')}
                </p>
              )}

              {outcomes && outcomes.length > 0 && (
                <>
                  {tops.length > 0 && (
                    <p className="text-center text-[10px] md:text-xs text-primary font-bold tracking-wide">
                      {N.t(tops.length > 1 ? 'os_top_intro_n' : 'os_top_intro', { n: tops.length })}
                    </p>
                  )}
                  <div className="flex flex-col gap-1">
                    {tops.map((t, i) => (
                      <div key={'n' + i} className="flex items-center justify-between px-3 py-1.5 rounded-lg bg-black/25 border border-white/5">
                        <span className="text-xs md:text-sm font-bold text-foreground">{t.race} m</span>
                        <span className="font-mono text-xs md:text-sm text-primary">{(t.ms / 1000).toFixed(2)} s</span>
                        <span className="text-[10px] md:text-xs text-muted-foreground">{N.ord(t.rank)}</span>
                      </div>
                    ))}
                    {/* Chronos plus lents que son propre record. Le tableau ne
                        garde qu'un chrono par epreuve et par appareil, le
                        meilleur : envoyer celui-ci le remplacerait par un
                        moins bon. On l'annonce franchement, parce qu'une
                        petite ligne grise se lisait comme « rien ne s'est
                        passe ». */}
                    {kept.length > 0 && (
                      <div className="rounded-xl border border-cyan-400/30 bg-cyan-400/[0.07] p-3 flex flex-col gap-1.5">
                        <span className="text-[10px] md:text-xs font-bold tracking-widest text-cyan-300 text-center">
                          {N.t('os_kept_title')}
                        </span>
                        {kept.map((t, i) => (
                          <div key={'k' + i} className="flex flex-col items-center gap-0.5">
                            <span className="text-xs md:text-sm text-foreground text-center">
                              {N.t('os_kept_line', {
                                d: t.race,
                                s: ((t.ownMs || 0) / 1000).toFixed(2),
                                r: t.ownRank ? N.ord(t.ownRank) : '—',
                              })}
                            </span>
                            <span className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
                              {N.t('os_kept_now', { s: (t.ms / 1000).toFixed(2) })}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {topStatus === 'done' ? (
                    tops.length > 0 ? (
                      <p className="text-center text-sm text-primary font-bold">
                        {N.t('os_top_saved', { n: topName.trim() })}
                      </p>
                    ) : null
                  ) : (
                    <>
                      <div className="flex gap-2">
                        <input
                          value={topName}
                          onChange={e => setTopName(e.target.value)}
                          placeholder={N.t('your_name')}
                          maxLength={20}
                          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                        />
                        <button
                          onClick={handleSaveTop}
                          disabled={!topName.trim() || topStatus === 'sending'}
                          className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                        >
                          {topStatus === 'sending' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          {N.t('save_score')}
                        </button>
                      </div>
                      {topStatus === 'error' && (
                        <p className="text-center text-xs text-destructive">{N.t('score_save_fail')}</p>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          )}

          {/* Creer un defi a partir de cette course. Hors defi c'est le
              partage normal ; apres un defi gagne c'est la revanche, qu'on
              renvoie a l'adversaire. */}
          {!falseOut && (!challenge || beaten) && (
            <div className={`w-full bg-card/60 border rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl flex flex-col gap-3
              ${beaten ? 'border-primary/40' : 'border-white/10'}`}>
              <div className="flex items-center gap-2 justify-center">
                <Ghost className="w-4 h-4 text-primary" />
                <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">
                  {N.t(beaten ? 'challenge_rematch' : 'challenge_make')}
                </h2>
              </div>
              {/* Defi adresse a quelqu'un du TOP 500 : on le rappelle, sinon
                  le joueur ne sait plus a qui son code va partir. */}
              {cible && (
                <p className="text-center text-[10px] md:text-xs text-cyan-300">
                  {N.t(code ? 'target_sent' : 'target_run', { n: cible.name, d: shotRaces[0] })}
                </p>
              )}
              {/* Revanche : on rappelle a qui le code doit repartir.
                  Le defi ne s'adresse pas tout seul — les noms ne sont pas des
                  adresses, et deux joueurs peuvent porter le meme. C'est donc
                  un rappel, pas un envoi : le code se recopie comme les
                  autres. */}
              {!cible && SprinterApp.G.revanche && (
                <p className="text-center text-[10px] md:text-xs text-primary">
                  {N.t('duel_renvoyer', { n: SprinterApp.G.revanche })}
                </p>
              )}

              {!code && (
                <>
                  <p className="text-center text-[10px] md:text-xs text-muted-foreground">
                    {N.t(beaten ? 'challenge_rematch_sub' : 'challenge_share')}
                  </p>
                  <div className="flex gap-2">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={N.t('your_name')}
                      maxLength={20}
                      className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
                    />
                    <button
                      onClick={handleCreate}
                      disabled={busy || !complete}
                      className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors flex items-center gap-2"
                    >
                      {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                      {busy ? N.t('challenge_making') : N.t(beaten ? 'challenge_rematch' : 'challenge_make')}
                    </button>
                  </div>
                  {err && <p className="text-center text-xs text-destructive">{N.t('challenge_net')}</p>}
                </>
              )}

              {code && (
                <div className="flex flex-col items-center gap-2">
                  <div className="font-mono font-black text-3xl md:text-4xl tracking-[0.35em] text-primary pl-[0.35em]">
                    {code}
                  </div>

                  {/* Envoi direct. WhatsApp et SMS acceptent un message
                      prerempli par simple lien. Snapchat et Instagram non :
                      ils passent par la feuille de partage du telephone. */}
                  <span className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground mt-1">
                    {N.t('share_send')}
                  </span>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <a
                      href={whatsappUrl(msg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: '#25D366' }}
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      {N.t('share_whatsapp')}
                    </a>
                    <a
                      href={smsUrl(msg)}
                      className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-background hover:opacity-90 transition-opacity flex items-center gap-2"
                      style={{ backgroundColor: '#4FC3F7' }}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      {N.t('share_sms')}
                    </a>
                    {canNativeShare() && (
                      <button
                        onClick={() => nativeShare(msg, code)}
                        className="px-4 py-2 rounded-xl font-bold tracking-wide text-[10px] md:text-xs text-primary bg-primary/10 border border-primary/30 hover:bg-primary/20 transition-colors flex items-center gap-2"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        {N.t('share_other')}
                      </button>
                    )}
                  </div>
                  {canNativeShare() && (
                    <p className="text-[9px] md:text-[10px] text-muted-foreground text-center max-w-xs leading-snug">
                      {N.t('share_other_hint')}
                    </p>
                  )}

                  {/* Copier reste un repli : traite en lien discret pour que
                      la rangee d'envoi garde le premier plan. */}
                  <div className="flex flex-wrap gap-x-5 gap-y-1 justify-center pt-1">
                    <button
                      onClick={() => handleCopy('code')}
                      className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {copied === 'code' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'code' ? N.t('code_copied') : N.t('challenge_copy_code')}
                    </button>
                    <button
                      onClick={() => handleCopy('link')}
                      className="text-[10px] md:text-xs font-bold tracking-widest text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                    >
                      {copied === 'link' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copied === 'link' ? N.t('challenge_copied') : N.t('challenge_copy')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {challenge && sent && (
            <p className="text-[10px] md:text-xs text-muted-foreground tracking-wide">
              {N.t('challenge_from', { n: challenge.owner_name })} &middot; {challenge.id}
            </p>
          )}

          {/* LA REPRISE.
              On rejoue tant que personne d'autre n'est engage : apres un faux
              depart, apres une chute, ou simplement parce que le chrono ne
              plait pas. Des qu'un adversaire attend le chrono, il est donne et
              ne se reprend plus. La regle et ses trois interdits vivent dans
              game/reprise, ou ils se lisent d'un bloc et se verifient sans
              lancer une course ; ici on ne fait que la lire.

              Le verrou est affiche plutot que taire le bouton sans un mot : un
              bouton qui disparait sans explication se cherche, et finit par
              passer pour une panne. */}
          <div className="flex flex-col gap-3 md:gap-4 w-full max-w-md mt-2">
            {verrou ? (
              <p className={`text-center text-[11px] md:text-xs tracking-wide leading-snug max-w-sm mx-auto
                ${verrou === 'faux_depart_duel' ? 'text-destructive font-bold'
                                                : 'text-muted-foreground'}`}>
                {N.t(verrou === 'defi_recu' ? 'os_verrou_recu'
                   : verrou === 'defi_envoye' ? 'os_verrou_envoye'
                   : 'os_verrou_faux')}
              </p>
            ) : (
              <>
                <button
                  onClick={() => SprinterApp.rejouerOneShot()}
                  className="w-full py-3 md:py-4 rounded-xl font-black font-display text-base sm:text-lg md:text-xl
                             tracking-widest text-background bg-emerald-400 hover:bg-emerald-300 transition-all
                             border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1
                             flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-4 h-4" />
                  {N.t('os_rejouer')}
                </button>
                <p className="text-center text-[10px] md:text-xs text-muted-foreground leading-snug -mt-1">
                  {N.t('os_rejouer_sub')}
                </p>
              </>
            )}
            {/* Ferme tant que DUELS_OUVERTS vaut false (voir game/duels). */}
            {DUELS_OUVERTS && <button
              onClick={() => setVoirDuels(true)}
              className="w-full py-3 md:py-4 rounded-xl font-black font-display text-base sm:text-lg md:text-xl
                         tracking-widest text-background bg-primary hover:bg-primary/90 transition-all
                         border-b-4 border-amber-600 active:border-b-0 active:translate-y-1
                         flex items-center justify-center gap-2"
            >
              <Swords className="w-4 h-4" />
              {N.t('duel_see')}
            </button>}
            <button onClick={() => SprinterApp.goHome()} className="w-full py-3 md:py-4 rounded-xl font-bold tracking-widest text-foreground bg-secondary hover:bg-secondary/80 transition-all border-b-4 border-black active:border-b-0 active:translate-y-1">
              {N.t('home')}
            </button>
          </div>

        </motion.div>
      </div>

      {voirDuels && <DuelRanking onClose={() => setVoirDuels(false)} />}
    </div>
  );
}
