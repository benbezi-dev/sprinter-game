import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { Ghost, Loader2 } from 'lucide-react';
import { fetchChallenge, codeFromUrl, clearUrlCode, normalizeCode, type Challenge } from '@/game/challenge';
import type { RaceKey } from '@/game/leaderboard';
import { estInstallee, estIOS } from '@/game/pwa';
import { LivePanel } from './LivePanel';
import { ChampPanel } from './ChampPanel';
import { DUELS_OUVERTS } from '@/game/duels';
import { OneShotTuto, oneShotTutoVu, marquerOneShotTutoVu } from './OneShotTuto';
import { GraduationCap } from 'lucide-react';

const RACE_KEYS: RaceKey[] = ['100', '200', '400'];

/* ------------------------------------------------------------------ one shot
   Une ou plusieurs epreuves choisies, courues une seule fois. Pas de
   cinematique, pas d'elimination : seul le cumul des chronos compte. */
export function OneShotPanel() {
  const { N, LEVELS } = SprinterApp;
  const [picked, setPicked] = useState<RaceKey[]>(['100']);
  const [level, setLevel] = useState(4);

  const toggle = (k: RaceKey) => {
    setPicked(p => (p.includes(k) ? p.filter(x => x !== k) : [...p, k]));
  };

  // Le mode est peu utilise, et le premier obstacle est de comprendre a quoi
  // il sert. On l'explique donc une fois, au moment ou l'on s'y interesse.
  const [tuto, setTuto] = useState(false);
  const vuDeja = useRef(false);
  useEffect(() => {
    if (vuDeja.current) return;
    vuDeja.current = true;
    if (!oneShotTutoVu()) setTuto(true);
  }, []);

  const partir = () => {
    if (!picked.length) return;
    // On garde l'ordre 100 / 200 / 400 quel que soit l'ordre des clics :
    // c'est l'ordre d'un vrai programme d'athletisme.
    const races = RACE_KEYS.filter(k => picked.includes(k));
    SprinterApp.startOneShot(races, { levelIdx: level });
  };

  const launch = partir;

  const fermerTuto = (lancer: boolean) => {
    marquerOneShotTutoVu();
    setTuto(false);
    if (lancer) partir();
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {tuto && <OneShotTuto onClose={fermerTuto} />}

      <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-4">
        <button
          onClick={() => setTuto(true)}
          className="self-center flex items-center gap-1.5 text-[10px] md:text-xs font-bold
                     tracking-widest text-muted-foreground hover:text-primary transition-colors"
        >
          <GraduationCap className="w-3.5 h-3.5" />
          {N.t('os_tuto_open')}
        </button>

        <div>
          <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-primary mb-2">
            {N.t('pick_events')}
          </h3>
          <div className="flex gap-2">
            {RACE_KEYS.map(k => (
              <button
                key={k}
                onClick={() => toggle(k)}
                className={`flex-1 py-2 md:py-3 rounded-xl font-bold tracking-wider transition-all border-b-2 text-sm md:text-base
                  ${picked.includes(k)
                    ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgba(248,205,74,0.2)]'
                    : 'bg-black/30 text-muted-foreground border-transparent hover:bg-white/10'}`}
              >
                {k} M
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-primary mb-2">
            {N.t('pick_level')}
          </h3>
          <select
            value={level}
            onChange={e => setLevel(Number(e.target.value))}
            className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary/50"
          >
            {LEVELS.map((_: unknown, i: number) => (
              <option key={i} value={i} className="bg-neutral-900">
                {i + 1}. {N.levelName(i)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={launch}
        disabled={!picked.length}
        className="w-full py-3 md:py-5 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 shadow-[0_0_30px_rgba(248,205,74,0.4)] disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
      >
        {N.t('launch_oneshot')}
      </button>
      {!picked.length && (
        <p className="text-center text-[10px] md:text-xs text-muted-foreground -mt-1">
          {N.t('pick_none')}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- defi
   On charge le defi d'un autre joueur a partir de son code, puis on court
   les memes epreuves contre son fantome. */
export function ChallengePanel() {
  const { N } = SprinterApp;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<'none' | 'bad' | 'net'>('none');
  const [ch, setCh] = useState<Challenge | null>(null);
  const autoTried = useRef(false);

  const load = async (raw: string) => {
    const id = normalizeCode(raw);
    if (!id) return;
    setBusy(true); setErr('none'); setCh(null);
    try {
      const found = await fetchChallenge(id);
      if (!found) setErr('bad');
      else setCh(found);
    } catch {
      setErr('net');
    } finally {
      setBusy(false);
    }
  };

  // Un lien ?defi=CODE ouvre directement le defi correspondant.
  const [venuDuLien, setVenuDuLien] = useState('');
  useEffect(() => {
    if (autoTried.current) return;
    autoTried.current = true;
    const fromUrl = codeFromUrl();
    if (fromUrl) { setCode(fromUrl); setVenuDuLien(fromUrl); clearUrlCode(); load(fromUrl); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lien ouvert dans Safari alors que le jeu est peut-etre installe. Android
  // et les navigateurs de bureau ouvrent d'eux-memes l'application (scope +
  // handle_links dans le manifeste) ; iOS n'a rien de tel et aucune page web
  // ne peut reveiller l'icone de l'ecran d'accueil. On rend donc le code
  // recopiable plutot que de laisser le joueur revenir en arriere le chercher.
  const horsApp = !!venuDuLien && estIOS() && !estInstallee();
  const [copie, setCopie] = useState(false);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(venuDuLien);
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch {
      // presse-papiers refuse : le code reste lisible et recopiable a la main
    }
  };

  const accept = () => {
    if (!ch) return;
    SprinterApp.startOneShot(ch.races, {
      levelIdx: ch.level_idx,
      ghosts: ch.traces,
      ghostSplits: ch.splits.map(ms => ms / 1000),
      ghostName: ch.owner_name,
      ghostTime: ch.total_ms / 1000,
      challenge: { id: ch.id, owner_name: ch.owner_name, total_ms: ch.total_ms },
    });
  };

  return (
    <div className="flex flex-col gap-3 md:gap-4">
      {/* Deux facons de se defier, dans l'ordre ou on les decouvre : celle qui
          demande que l'autre soit la maintenant, puis celle qui s'accommode
          d'une reponse le lendemain. La premiere alimente le meme classement
          que la seconde, elle passe donc par le meme interrupteur. */}
      {DUELS_OUVERTS && <LivePanel />}
      {/* Le championnat n'apparait que si le joueur y est engage. */}
      {DUELS_OUVERTS && <ChampPanel />}

      <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-3">
        <p className="text-[10px] md:text-xs text-muted-foreground text-center tracking-wide">
          {N.t('versus_desc')}
        </p>

        {horsApp && (
          <div className="rounded-xl border border-cyan-400/35 bg-cyan-400/[0.07] px-3 py-2.5
                          flex flex-col items-center gap-1.5">
            <span className="text-[10px] md:text-xs font-bold tracking-widest text-cyan-300 text-center">
              {N.t('link_in_app')}
            </span>
            <span className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug">
              {N.t('link_in_app_sub')}
            </span>
            <button
              onClick={copier}
              className="mt-0.5 px-4 py-1.5 rounded-lg bg-black/40 border border-white/10
                         font-mono font-bold tracking-[0.3em] text-sm text-cyan-200
                         hover:bg-black/60 transition-colors pl-[0.3em]"
            >
              {copie ? N.t('code_copied') : venuDuLien}
            </button>
          </div>
        )}

        <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-primary text-center">
          {N.t('challenge_code')}
        </h3>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => { if (e.key === 'Enter') load(code); }}
            placeholder={N.t('challenge_enter')}
            maxLength={10}
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm font-mono tracking-[0.3em] text-center text-foreground placeholder:text-muted-foreground placeholder:tracking-normal placeholder:font-sans focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={() => load(code)}
            disabled={busy || !normalizeCode(code)}
            className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs md:text-sm text-background bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors"
          >
            {N.t('challenge_load')}
          </button>
        </div>

        {busy && (
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            {N.t('challenge_loading')}
          </div>
        )}
        {err === 'bad' && <p className="text-center text-xs text-destructive">{N.t('challenge_bad')}</p>}
        {err === 'net' && <p className="text-center text-xs text-destructive">{N.t('challenge_net')}</p>}

        {ch && (
          <div className="mt-1 rounded-xl border border-primary/30 bg-primary/10 p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 justify-center">
              <Ghost className="w-4 h-4 text-primary" />
              <span className="font-bold text-sm text-primary tracking-wide">
                {N.t('challenge_from', { n: ch.owner_name })}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 justify-center">
              {ch.races.map((r, i) => (
                <span key={i} className="text-[10px] md:text-xs font-mono bg-black/30 border border-white/10 rounded-md px-2 py-1">
                  {r} m &middot; {(ch.splits[i] / 1000 || 0).toFixed(2)} s
                </span>
              ))}
            </div>
            <div className="text-center text-sm font-bold text-foreground">
              {N.t('challenge_beat', { s: (ch.total_ms / 1000).toFixed(2) })}
            </div>
            <div className="text-center text-[10px] text-muted-foreground">
              {N.levelName(ch.level_idx)}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={accept}
        disabled={!ch}
        className="w-full py-3 md:py-5 rounded-xl font-black font-display text-lg md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 shadow-[0_0_30px_rgba(248,205,74,0.4)] disabled:opacity-40 disabled:pointer-events-none disabled:shadow-none"
      >
        {N.t('challenge_accept')}
      </button>
    </div>
  );
}
