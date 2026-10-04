import React, { useEffect, useRef, useState } from 'react';
import { Globe, Lock, ChevronLeft, Swords, Trophy } from 'lucide-react';
import { DUELS_OUVERTS, fetchDuels, type MonRang } from '@/game/duels';
import { jeuDe } from '@/game/jeux';
import { Ecusson } from '@/components/Insignes';
import { DuelRanking } from './DuelRanking';
import { SprinterApp, toggleLang, toggleAudio, useGameStore } from '@/game/engine';
import '@/game/sauts-mots.js'; // les mots des sauts, hors de la table commune
import { allerAu } from '@/game/mondes';
import { useGesteMondes } from '@/hooks/use-geste-mondes';
import { LONGUEUR_OUVERTE, TRIPLE_OUVERT, HAUTEUR_OUVERTE } from '@/game/canal';
import { lireHauteur } from '@/game/hauteur.js';
import { PLATEAU as PLATEAU_LONGUEUR } from '@/game/longueur-jeu.js';
import { PLATEAU_TRIPLE } from '@/game/triple-jeu.js';
import { PLATEAU as PLATEAU_HAUTEUR } from '@/game/hauteur-jeu.js';
import { NameChip } from './NameChip';
import { Longueur } from './Longueur';
import { Hauteur } from './Hauteur';
import { lireMemoire, type MemoireSaut } from './sauts-commun';

/**
 * L'ACCUEIL DE JUMPER — le meme que celui de Sprinter et de Hurdlers.
 *
 * Meme en-tete (la langue, le nom, le son), meme carte de titre, memes trois
 * onglets — CARRIERE, ONE SHOT, DEFI —, meme selecteur d'epreuve, memes
 * meilleurs parcours, meme COMMENCER, meme pied de page. Seuls changent ce qui
 * dit dans quel jeu on est : le nom, le vert electrique (index.css,
 * data-jeu="jumper"), la musique (MUSIQUES_SAUTS), et des marques en metres a
 * la place des chronos.
 *
 * Il se pose sur le stade, transparent, comme l'accueil de Sprinter : le
 * passage vient d'amener la camera sur les sautoirs, on les voit derriere.
 *
 * LA CARRIERE EST CELLE DE SPRINTER : six etapes, dans l'ordre, chacune
 * presentee par sa carte ; un podium ouvre la suivante, une etape manquee
 * arrete le parcours. Le ONE SHOT rejoue un concours, a l'etape de son choix
 * parmi celles qu'on a ouvertes.
 */

type Epreuve = 'longueur' | 'triple' | 'hauteur' | 'perche';
type Onglet = 'career' | 'oneshot' | 'versus';
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

const EPREUVES: { cle: Epreuve; nom: string; ouverte: boolean }[] = [
  { cle: 'longueur', nom: 'saut_court_longueur', ouverte: LONGUEUR_OUVERTE },
  { cle: 'triple', nom: 'saut_court_triple', ouverte: TRIPLE_OUVERT },
  { cle: 'hauteur', nom: 'saut_court_hauteur', ouverte: HAUTEUR_OUVERTE },
  { cle: 'perche', nom: 'saut_court_perche', ouverte: false },
];
const CLES: Record<string, string> = {
  longueur: 'sprinter.longueur.v1', triple: 'sprinter.triple.v1', hauteur: 'sprinter.hauteur.v1',
};
const TITRES: Record<string, string> = {
  longueur: 'disc_longueur', triple: 'disc_triple', hauteur: 'disc_hauteur', perche: 'disc_perche',
};
const AIDES: Record<string, string[]> = {
  longueur: ['saut_aide_1', 'saut_aide_2', 'saut_aide_3', 'saut_aide_4'],
  triple: ['triple_aide_1', 'triple_aide_2', 'triple_aide_3', 'triple_aide_4'],
  hauteur: ['haut_aide_1', 'haut_aide_2', 'haut_aide_3', 'haut_aide_4', 'haut_aide_5'],
};

function plateauDe(e: Epreuve): [number, number][] {
  if (e === 'triple') return PLATEAU_TRIPLE as [number, number][];
  if (e === 'hauteur') return (PLATEAU_HAUTEUR as any[]).map(p => p.niveaux as [number, number]);
  return PLATEAU_LONGUEUR as [number, number][];
}

const marque = (m: number, e: Epreuve) => e === 'hauteur'
  ? lireHauteur(m, SprinterApp.N.getLang() === 'fr' ? ',' : '.')
  : m.toFixed(2).replace('.', SprinterApp.N.getLang() === 'fr' ? ',' : '.');

type Partie = { epreuve: Epreuve; etape: number; carriere: boolean; n: number };

export function Jumper() {
  const { N, Audio_ } = SprinterApp;
  // ses boutons de langue et de son : redessines quand l'une ou l'autre change
  useGameStore(() => N.getLang());
  useGameStore(() => Audio_.on);
  const [epreuve, setEpreuve] = useState<Epreuve>(() => {
    try { const e = localStorage.getItem('sprinter.jumper.epreuve'); if (e && CLES[e]) return e as Epreuve; } catch { /* rien */ }
    return 'longueur';
  });
  const [onglet, setOnglet] = useState<Onglet>('career');
  const [partie, setPartie] = useState<Partie | null>(null);
  const [aide, setAide] = useState<null | 'jeu' | 'regle'>(null);
  // Le classement des duels, comme sur l'accueil de Sprinter (TitleScreen).
  // Les sauts n'ont pas encore de duels : on y montre ceux du sprint, et
  // l'ecusson du sprint, sans marquer la visite.
  const [voirDuels, setVoirDuels] = useState(false);
  const [monRang, setMonRang] = useState<MonRang | null>(null);
  useEffect(() => {
    if (!DUELS_OUVERTS) return;
    let annule = false;
    fetchDuels(undefined, false).then(b => {
      if (!annule) setMonRang((b?.mes_epreuves || []).find(r => jeuDe(String(r.epreuve).split('+')[0]) === 'sprinter') || null);
    });
    return () => { annule = true; };
  }, []);
  const [memoire, setMemoire] = useState<MemoireSaut>(() => lireMemoire(CLES[epreuve]));
  const zone = useRef<HTMLDivElement>(null);
  const rouleau = useRef<HTMLDivElement>(null);

  useEffect(() => { setMemoire(lireMemoire(CLES[epreuve] || CLES.longueur)); }, [epreuve, partie]);
  useEffect(() => { try { localStorage.setItem('sprinter.jumper.epreuve', epreuve); } catch { /* rien */ } }, [epreuve]);

  // On revient a Sprinter par la gauche : c'est de la qu'on est venu.
  useGesteMondes(zone, (g) => { if (g === 'gauche' && !partie) allerAu('sprinter'); }, true, rouleau);
  useEffect(() => {
    const sortir = () => allerAu('sprinter');
    window.addEventListener('popstate', sortir);
    return () => window.removeEventListener('popstate', sortir);
  }, []);

  if (partie) {
    const fin = () => setPartie(null);
    const lancer = (etape: number, carriere: boolean) =>
      setPartie(p => ({ epreuve: p!.epreuve, etape, carriere, n: (p ? p.n : 0) + 1 }));
    const props = {
      key: partie.n, etape: partie.etape, carriere: partie.carriere, onQuitter: fin,
      onSuivant: () => lancer(partie.etape + 1, partie.carriere),
      onRejouer: () => lancer(partie.etape, partie.carriere),
      onCarriere: () => lancer(0, true),
    };
    return partie.epreuve === 'hauteur'
      ? <Hauteur {...props} />
      : <Longueur epreuve={partie.epreuve as 'longueur' | 'triple'} {...props} />;
  }

  const ouverte = EPREUVES.find(x => x.cle === epreuve)!.ouverte;
  const plateau = plateauDe(epreuve);
  const commencer = () => setPartie({ epreuve, etape: 0, carriere: true, n: 1 });

  return (
    <div ref={zone}
         className="fixed inset-0 z-[45] w-full h-full flex flex-col pointer-events-auto overflow-hidden bg-black/20
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),0.25rem)]">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* L'en-tete, celui de Sprinter. */}
        <div className="w-full flex justify-between items-start z-20 shrink-0 mb-2 md:mb-4">
          <button onClick={() => toggleLang()}
                  className="bg-card/80 backdrop-blur-md border border-white/10 px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-1.5 md:gap-2 hover:bg-white/10 transition-colors">
            <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-muted-foreground" />
            <span className="font-bold text-xs md:text-sm text-foreground/90">{N.getLang().toUpperCase()}</span>
          </button>
          <NameChip />
          <button onClick={() => toggleAudio()}
                  className="bg-card/80 backdrop-blur-md border border-white/10 p-2 md:p-3 rounded-xl hover:bg-white/10 transition-colors">
            <img src={`${BASE}/icons/${Audio_.on ? 'audio-on' : 'audio-off'}.png`} alt=""
                 className={`w-4 h-4 md:w-5 md:h-5 ${Audio_.on ? 'opacity-100' : 'opacity-40'}`} />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex flex-col landscape:flex-row items-center landscape:items-stretch gap-2 landscape:gap-8 max-w-5xl mx-auto w-full">
          {/* Le titre, et la place laissee au sautoir derriere. */}
          <div className="flex-1 w-full flex flex-col items-center landscape:items-start text-center landscape:text-left">
            <div className="order-1 landscape:order-2 shrink-0 mt-2 md:mt-0 bg-card/60 backdrop-blur-sm border border-white/10 px-6 py-5 md:px-8 md:py-6 rounded-2xl landscape:w-full max-w-md border-t-white/20">
              <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black font-display tracking-tight text-primary drop-shadow-md">
                JUMPER
              </h1>
              <p className="mt-1 md:mt-2 text-[10px] sm:text-xs md:text-base lg:text-xl font-medium text-foreground/80 tracking-wide uppercase">
                {onglet === 'career'
                  ? <>{N.t(TITRES[epreuve])} &mdash; {N.t('six_stages_bare')}</>
                  : N.t(onglet === 'oneshot' ? 'jumper_oneshot_desc' : 'jumper_versus_desc')}
              </p>
            </div>
            <div aria-hidden className="order-2 landscape:order-1 w-full max-w-md flex-1 min-h-[84px] landscape:min-h-[96px]" />
            <div className="hidden landscape:block order-3 flex-1" />
          </div>

          {/* Le menu, seul a defiler. */}
          <div ref={rouleau}
               className="flex-initial landscape:flex-1 min-h-0 overflow-y-auto flex flex-col
                          w-[calc(100%+4rem)] max-w-[calc(28rem+4rem)] -mx-8 px-8 -mb-4">
            <div className="my-auto flex flex-col gap-3 sm:gap-4 md:gap-6 w-full pt-2 pb-6">
              {/* Les trois onglets de Sprinter. */}
              <div className="flex gap-1 p-1 rounded-2xl bg-black/60 backdrop-blur-md border border-white/10">
                {(['career', 'oneshot', 'versus'] as Onglet[]).map(o => (
                  <button key={o} onClick={() => setOnglet(o)}
                    className={`flex-1 py-2 rounded-xl font-bold tracking-widest text-[10px] md:text-xs transition-all
                      ${onglet === o
                        ? 'bg-primary text-background shadow-[0_0_15px_rgb(var(--primaire-rgb)/0.25)]'
                        : 'text-foreground/70 hover:text-foreground hover:bg-white/10'}`}>
                    {N.t(o === 'career' ? 'mode_career' : o === 'oneshot' ? 'mode_oneshot' : 'mode_versus')}
                  </button>
                ))}
              </div>

              {/* Le classement des duels, sous les onglets comme chez Sprinter. */}
              {DUELS_OUVERTS && <button
                onClick={() => setVoirDuels(true)}
                className="w-full px-4 py-3 rounded-2xl bg-black/70 backdrop-blur-md
                           border border-primary/50 hover:bg-black/85 transition-colors
                           shadow-[0_0_25px_rgb(var(--primaire-rgb)/0.2)]
                           flex items-center justify-between gap-3 text-left"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <Swords className="w-4 h-4 md:w-5 md:h-5 text-primary shrink-0" />
                  <span className="flex flex-col min-w-0">
                    <span className="font-bold tracking-widest text-primary text-[11px] md:text-sm truncate">
                      {N.t('duel_open')}
                    </span>
                    <span className="text-[9px] md:text-[10px] text-foreground/60 truncate">
                      {N.t('duel_sub')}
                    </span>
                  </span>
                </span>
                {monRang
                  ? <Ecusson etage={monRang.etage} division={monRang.division}
                             epreuve={monRang.epreuve}
                             lp={monRang.etage === 'legende' ? monRang.lp : undefined} />
                  : <span className="font-mono text-[9px] md:text-[10px] text-primary/60
                                     shrink-0 tracking-wider">—</span>}
              </button>}

              {/* Le retour vers Sprinter, par ou l'on est venu. */}
              <div className="flex items-center justify-start gap-2 px-1 pt-1 pb-0.5">
                <button onClick={() => allerAu('sprinter')}
                        className="flex items-center gap-1 text-[9px] tracking-widest text-white/40 hover:text-white/80 transition-colors">
                  <ChevronLeft className="w-3 h-3" /> SPRINTER
                </button>
              </div>

              {/* Le selecteur d'epreuve : les quatre sauts. */}
              <div className="grid grid-cols-4 gap-2">
                {EPREUVES.map(x => (
                  <button key={x.cle} disabled={!x.ouverte} onClick={() => setEpreuve(x.cle)}
                    className={`py-2 md:py-3 rounded-xl font-bold tracking-wider transition-all border-b-2 text-[11px] md:text-sm
                      flex items-center justify-center gap-1
                      ${epreuve === x.cle
                        ? 'bg-primary/20 text-primary border-primary shadow-[0_0_15px_rgb(var(--primaire-rgb)/0.2)]'
                        : x.ouverte ? 'bg-card/80 text-muted-foreground border-transparent hover:bg-white/10'
                                    : 'bg-card/50 text-muted-foreground/40 border-transparent'}`}>
                    {!x.ouverte && <Lock className="w-3 h-3" />}
                    {N.t(x.nom)}
                  </button>
                ))}
              </div>

              {onglet === 'career' && (
                <>
                  {/* Les meilleurs sauts, comme les meilleurs parcours. */}
                  <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 md:p-5 shadow-2xl flex flex-col gap-2 md:gap-3">
                    <div className="flex items-center gap-2">
                      <Trophy className="w-4 h-4 shrink-0 text-primary" />
                      <h2 className="flex-1 min-w-0 font-bold tracking-widest text-primary text-[11px] md:text-sm leading-tight">
                        {N.t('saut_meilleurs')}
                      </h2>
                      {memoire.pb && (
                        <span className="shrink-0 px-2.5 py-1 rounded-lg bg-primary/10 border border-primary/30 text-primary font-bold tracking-widest text-[9px] md:text-[11px]">
                          {N.t('saut_rp')} {marque(memoire.pb.m, epreuve)} m
                        </span>
                      )}
                    </div>
                    {!memoire.marques.length ? (
                      <p className="text-[11px] md:text-sm text-center leading-snug text-muted-foreground">
                        {N.t('saut_aucun')}{' — '}
                        <span className="text-foreground/90 font-bold uppercase tracking-wide">
                          {N.t('furthest')} {memoire.plusLoin} {N.t('of_six')}
                        </span>
                      </p>
                    ) : (
                      <div className="flex flex-col gap-1">
                        {memoire.marques.slice(0, 5).map((r, i) => (
                          <div key={i} className="flex items-center text-[11px] md:text-sm font-mono bg-black/20 rounded-md px-2 py-1 md:px-3 md:py-1.5 border border-white/5">
                            <span className="w-4 md:w-6 text-muted-foreground/50">{i + 1}.</span>
                            <span className={`font-bold ml-1 md:ml-2 ${i === 0 ? 'text-primary' : i < 3 ? 'text-cyan-400' : 'text-foreground'}`}>
                              {marque(r.m, epreuve)} m
                            </span>
                            <div className="flex-1 ml-2 md:ml-4 h-1 md:h-1.5 bg-black/40 rounded-full overflow-hidden">
                              <div className={`h-full ${i === 0 ? 'bg-primary' : i < 3 ? 'bg-cyan-400' : 'bg-white/40'}`}
                                   style={{ width: `${(r.m / memoire.marques[0].m) * 100}%` }} />
                            </div>
                            <span className="ml-2 text-[9px] text-muted-foreground/60 truncate max-w-[6rem]">{N.levelName(r.etape)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <button onClick={commencer} disabled={!ouverte}
                    className="w-full py-3 md:py-5 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest text-background bg-primary hover:bg-primary/90 transition-all border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1 shadow-[0_0_30px_rgb(var(--primaire-rgb)/0.4)] disabled:opacity-40">
                    {N.t('start')}
                  </button>
                </>
              )}

              {onglet === 'oneshot' && (
                <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-2">
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground">{N.t('jumper_oneshot_choix')}</p>
                  {plateau.map(([lo, hi], i) => {
                    const ok = ouverte && i <= memoire.debloque;
                    return (
                      <button key={i} disabled={!ok} onClick={() => setPartie({ epreuve, etape: i, carriere: false, n: 1 })}
                        className={`w-full px-3 py-2.5 rounded-xl border flex items-center gap-3 text-left transition-colors
                          ${ok ? 'border-white/15 bg-black/30 hover:bg-white/10' : 'border-white/5 bg-black/20'}`}>
                        <span className="w-5 font-mono text-[11px] text-primary">{i + 1}</span>
                        <span className="flex-1 min-w-0 flex flex-col">
                          <span className={`font-bold tracking-widest text-[11px] md:text-sm ${ok ? 'text-foreground' : 'text-foreground/35'}`}>
                            {N.levelName(i)}
                          </span>
                          <span className="font-mono text-[9px] text-muted-foreground/70">
                            {marque(lo, epreuve)} – {marque(hi, epreuve)} m
                          </span>
                        </span>
                        {ok ? <span className="text-[9px] tracking-widest text-primary">{N.t('monde_jouer')}</span>
                            : <Lock className="w-3.5 h-3.5 text-white/30" />}
                      </button>
                    );
                  })}
                  <p className="text-center text-[9px] text-muted-foreground/60">{N.t('saut_verrou')}</p>
                </div>
              )}

              {onglet === 'versus' && (
                <div className="bg-card/70 backdrop-blur-xl border border-primary/30 rounded-2xl p-4 shadow-2xl flex flex-col items-center gap-2 text-center">
                  <Swords className="w-6 h-6 text-primary" />
                  <p className="font-bold tracking-widest text-primary text-sm">{N.t('jumper_versus_titre')}</p>
                  <p className="text-[11px] leading-snug text-foreground/70">{N.t('jumper_versus_txt')}</p>
                  <span className="mt-1 flex items-center gap-1.5 text-[9px] tracking-widest text-white/40">
                    <Lock className="w-3 h-3" /> {N.t('monde_bientot')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Le pied, celui de Sprinter : trois liens sur une ligne. */}
      <div className="relative z-10 shrink-0 w-full max-w-md mx-auto mt-4 flex items-center justify-between gap-1">
        {[
          { cle: 'jumper_reglement', action: () => setAide('regle') },
          { cle: 'jumper_comment', action: () => setAide('jeu') },
          { cle: 'contact', action: () => { window.location.href = 'mailto:support@sprinter-game.com'; } },
        ].map(({ cle, action }) => (
          <button key={cle} onClick={action}
                  className="px-0.5 py-1.5 whitespace-nowrap text-[clamp(7px,2.6vw,11px)] font-bold tracking-wide leading-none text-muted-foreground hover:text-primary transition-colors">
            {N.t(cle)}
          </button>
        ))}
      </div>

      {DUELS_OUVERTS && voirDuels && <DuelRanking onClose={() => setVoirDuels(false)} />}

      {aide && (
        <div className="fixed inset-0 z-[48] flex items-center justify-center bg-black/60 pointer-events-auto" onClick={() => setAide(null)}>
          <div className="w-[min(92vw,24rem)] rounded-2xl border border-white/12 bg-[rgba(9,12,24,0.92)] p-4 flex flex-col gap-3" onClick={e => e.stopPropagation()}>
            <p className="font-display font-black text-xl text-primary tracking-tight">{N.t(TITRES[epreuve])}</p>
            {aide === 'jeu' ? (
              <ol className="flex flex-col gap-1.5">
                {(AIDES[epreuve] || []).map((k, i) => (
                  <li key={k} className="flex gap-2 text-[12px] leading-snug text-white/80">
                    <span className="font-mono font-bold shrink-0 text-primary">{i + 1}</span><span>{N.t(k)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <div className="flex flex-col gap-1.5 text-[12px] leading-snug text-white/80">
                <p>{N.t(epreuve === 'hauteur' ? 'haut_cotes' : epreuve === 'triple' ? 'triple_cotes' : 'saut_cotes')}</p>
                <p>{N.t(epreuve === 'hauteur' ? 'haut_regle' : 'saut_regle')}</p>
                <p className="text-white/50">{N.t('saut_verrou')}</p>
              </div>
            )}
            <button onClick={() => setAide(null)} className="py-2 rounded-xl bg-primary text-black font-black tracking-widest text-sm">OK</button>
          </div>
        </div>
      )}
    </div>
  );
}
