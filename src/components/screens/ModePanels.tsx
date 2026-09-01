import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { Ghost, Loader2, Radio, Users, Trophy } from 'lucide-react';
import { fetchChallenge, codeFromUrl, clearUrlCode, normalizeCode, type Challenge } from '@/game/challenge';
import type { RaceKey } from '@/game/leaderboard';
import { estInstallee, estIOS } from '@/game/pwa';
import { LivePanel, type Etape } from './LivePanel';
import { ChampPanel } from './ChampPanel';
import { RelaisPanel } from './RelaisPanel';
import { codeDirectUrl } from '@/game/live';
import { EST_TEST } from '@/game/canal';
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
   Se mesurer a quelqu'un. Quatre facons, selon que l'autre est la maintenant
   ou qu'il repondra demain, qu'on court seul ou a quatre : le direct, le
   fantome charge par son code, le relais, et le championnat. */

type Sous = 'direct' | 'code' | 'relais' | 'champ';

type Onglet = {
  id: Sous;
  cle: string;
  Icone: typeof Radio;
  /** Couleur de l'icone au repos. */
  teinte: string;
  /** Fond de la pastille quand elle est choisie. */
  fond: string;
};

/**
 * Y a-t-il plus d'une facon de se mesurer a quelqu'un sur ce canal ?
 *
 * Le direct et le championnat suivent les duels, le relais le canal de test.
 * Tout ferme, il ne reste que le defi differe — il est alors seul, et l'ecran
 * s'en explique une fois plutot que deux.
 */
export const PLUSIEURS_DEFIS = DUELS_OUVERTS || EST_TEST;

/**
 * Un panneau range derriere son onglet.
 *
 * Cache, pas demonte : ce qu'il tient — une salle ouverte, un fil d'annonces —
 * appartient a la course et doit survivre au fait qu'on regarde ailleurs.
 */
function Volet({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  return (
    <div className={`flex-col gap-3 md:gap-4 ${actif ? 'flex' : 'hidden'}`}>
      {children}
    </div>
  );
}

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

  // La facon de se mesurer qu'on regarde en ce moment. Un lien tranche pour
  // nous : ?defi= ouvre le fantome, ?direct= ouvre la piste. Sinon on montre
  // le direct, qui est la porte la plus large — a defaut, le fantome, seule
  // facon ouverte tant que les duels sont fermes.
  const [sous, setSous] = useState<Sous>(() => {
    if (codeFromUrl()) return 'code';
    if (codeDirectUrl()) return 'direct';
    return DUELS_OUVERTS ? 'direct' : 'code';
  });

  // Une salle du direct ouverte revient toujours devant. Des gens y attendent
  // le coup de pistolet : la laisser vivre derriere un onglet ferme, c'est
  // faire rater le depart a celui qui l'a ouverte.
  const [etapeDirect, setEtapeDirect] = useState<Etape>('repos');
  const pisteOuverte = etapeDirect !== 'repos';
  useEffect(() => { if (pisteOuverte) setSous('direct'); }, [pisteOuverte]);

  // Suis-je engage dans un championnat ? La reponse vient du panneau lui-meme
  // (voir ChampPanel), et elle decide si l'onglet existe.
  const [champ, setChamp] = useState(false);

  const onglets: Onglet[] = [];
  if (DUELS_OUVERTS) onglets.push({
    id: 'direct', cle: 'sub_direct', Icone: Radio,
    teinte: 'text-emerald-400', fond: 'bg-emerald-400',
  });
  onglets.push({
    id: 'code', cle: 'sub_ghost', Icone: Ghost,
    teinte: 'text-primary', fond: 'bg-primary',
  });
  // Le relais n'est ouvert que sur le canal de test. En production, EST_TEST
  // vaut false en dur et le bundler retire tout le panneau.
  if (EST_TEST) onglets.push({
    id: 'relais', cle: 'sub_relais', Icone: Users,
    teinte: 'text-emerald-400', fond: 'bg-emerald-400',
  });
  // Le championnat n'apparait qu'a qui y est engage.
  if (DUELS_OUVERTS && champ) onglets.push({
    id: 'champ', cle: 'sub_champ', Icone: Trophy,
    teinte: 'text-primary', fond: 'bg-primary',
  });

  // Un onglet peut disparaitre sous les pieds — le championnat se termine, un
  // drapeau se ferme. On retombe alors sur le premier plutot que sur du vide.
  const actif: Sous = onglets.some(o => o.id === sous) ? sous : (onglets[0]?.id ?? 'code');
  // A quatre de front, les libelles n'ont plus la place de respirer.
  const serre = onglets.length >= 4;

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
      {/* La rangee des facons de se mesurer a quelqu'un.

          Elles etaient empilees les unes sous les autres, ce qui revenait a
          n'en montrer qu'une : celle du haut. Les autres n'existaient que pour
          qui savait deja qu'elles etaient la et faisait glisser la page pour
          les retrouver — c'est-a-dire pour personne, le premier jour.

          On reprend donc, un cran plus bas, le geste qui sert deja aux modes
          de jeu : une rangee, une facon a la fois, et tout ce qui existe
          visible d'un coup d'oeil sans rien faire defiler. Chaque pastille
          garde la couleur de son panneau — vert pour ce qui se court a
          plusieurs et maintenant, or pour ce qui se joue contre un chrono deja
          pose — pour qu'on retienne les differences avant meme de les lire.

          Une seule facon ouverte, pas de rangee : un choix unique ne se
          presente pas comme un choix. */}
      {onglets.length > 1 && (
        <div className="flex gap-1 p-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
          {onglets.map(o => {
            const on = actif === o.id;
            return (
              <button
                key={o.id}
                onClick={() => setSous(o.id)}
                aria-pressed={on}
                className={`relative flex-1 min-w-0 flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all
                  ${on
                    ? `${o.fond} text-background`
                    : 'text-foreground/70 hover:text-foreground hover:bg-white/10'}`}
              >
                <o.Icone className={`w-3.5 h-3.5 shrink-0 ${on ? '' : o.teinte}`} />
                <span className={`w-full truncate text-center font-bold leading-tight
                  ${serre ? 'text-[8px] tracking-wide' : 'text-[9px] md:text-[11px] tracking-widest'}`}>
                  {N.t(o.cle)}
                </span>
                {/* Une piste ouverte pendant qu'on regarde ailleurs. Le point
                    ne sert que dans ce cas : d'ordinaire l'onglet est deja
                    revenu devant tout seul. */}
                {o.id === 'direct' && pisteOuverte && !on && (
                  <span className="absolute top-1 right-1.5 flex h-1.5 w-1.5"
                        title={N.t('sub_direct_on')}>
                    <span className="animate-ping absolute inline-flex h-full w-full
                                     rounded-full bg-emerald-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Les panneaux restent montes, celui qu'on ne regarde pas y compris.
          Une salle du direct tient une liaison ouverte, le championnat un fil
          d'annonces, le relais son vestiaire : les demonter au changement
          d'onglet couperait des choses qui appartiennent a la course, pas a
          l'ecran qui la regarde. C'est deja ainsi qu'ils vivaient quand ils
          etaient tous les quatre a l'ecran en meme temps. */}
      {DUELS_OUVERTS && (
        <Volet actif={actif === 'direct'}>
          <LivePanel onEtape={setEtapeDirect} />
        </Volet>
      )}

      {EST_TEST && (
        <Volet actif={actif === 'relais'}>
          <RelaisPanel />
        </Volet>
      )}

      {DUELS_OUVERTS && (
        <Volet actif={actif === 'champ'}>
          <ChampPanel onEdition={e => setChamp(!!e)} />
        </Volet>
      )}

      <Volet actif={actif === 'code'}>
      <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-4 md:p-6 shadow-2xl flex flex-col gap-3">
        {/* Le panneau se presente comme ses voisins : un titre, une ligne pour
            dire ce que c'est. Quand il est seul, la ligne est deja sous le
            titre du jeu et on ne la repete pas. */}
        <div className="flex items-center gap-2 justify-center">
          <Ghost className="w-4 h-4 text-primary" />
          <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-primary">
            {N.t('challenge_titre')}
          </h3>
        </div>
        {PLUSIEURS_DEFIS && (
          <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
            {N.t('versus_desc')}
          </p>
        )}

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
            {/* Les epreuves, sans les chronos.
                Connaitre le temps a battre avant de partir transforme le duel
                en calcul : on regarde le nombre et on decide si ca vaut la
                peine d'essayer. On l'apprend en courant, comme sur une piste —
                le fantome est la, a cote, et il dit tout ce qu'il faut. */}
            <div className="flex flex-wrap gap-1.5 justify-center">
              {ch.races.map((r, i) => (
                <span key={i} className="text-[10px] md:text-xs font-mono bg-black/30 border border-white/10 rounded-md px-2 py-1">
                  {r} m
                </span>
              ))}
            </div>
            <div className="text-center text-[11px] md:text-xs text-muted-foreground">
              {N.t('challenge_aveugle')}
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
      </Volet>
    </div>
  );
}
