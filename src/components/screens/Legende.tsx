import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Bike, Car, Bus, Plane, Rocket, Lock, Crown, Medal, ChevronRight, ChevronLeft } from 'lucide-react';
import { PANNEAU, VOILE } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import { drapeauDe } from '@/components/Insignes';
import { getSavedName } from '@/game/leaderboard';
import { CARRIERES_REQUISES, carrieresGagnees, type ChoixCarriere } from '@/game/legende/compte';
import { ETAPES, type Transport } from '@/game/legende/etapes';
import {
  commencerLaLegende, lancerLEtape, conclureLEtape, etapeSuivante, rangerLaLegende,
  memoire, lieuDeLEtape, rangEnCours, chronoDuBoss, type Verdict,
} from '@/game/legende/legende';
import { mot, chrono, dans } from '@/game/legende/mots';
import { CarteDuVoyage } from './LegendeCarte';
import { CinematiqueKarman } from './LegendeKarman';
import { CinematiqueVoyage, CinematiqueApotheose, CinematiqueSacre } from './LegendeCinematiques';
import { PORTRAITS, TEINTES } from './legende-commun';

/* ---------------------------------------------------------------------------
   LA CARRIERE LEGENDE — les ecrans du mode
   ---------------------------------------------------------------------------
   L'onglet CARRIERE (d'abord le choix entre la carriere classique et la
   Legende, fermee avant les 30), une affiche avant chaque etape (le joueur a gauche, le
   boss a droite, comme l'ecran VS d'un jeu de combat), et l'ecran de fin qui
   decide de la suite. La carte du monde entre deux etapes viendra
   se poser AVANT l'affiche (projets/carriere-legende/PLAN.md, etape 2).

   CANAL DE TEST SEULEMENT. Ce fichier n'est atteint que par deux `lazy`
   (TitleScreen.tsx, App.tsx) derriere `LEGENDE_OUVERTE && ...` : en
   production le drapeau vaut `false` en dur, et rien d'ici n'est emis.
--------------------------------------------------------------------------- */

const OR = '#E8B84A';

const ICONES: Record<Transport, typeof Bike> = { velo: Bike, voiture: Car, car: Bus, avion: Plane, fusee: Rocket };

/* ===========================================================================
   LE CHOIX, A L'OUVERTURE DE L'ONGLET CARRIERE
   ===========================================================================
   La Legende est IMBRIQUEE dans la carriere (l'auteur, 07/10/2026) : ouvrir
   l'onglet CARRIERE montre d'abord deux cartes, la carriere classique et la
   Legende, et toucher l'une ouvre ce mode. Tant qu'il manque des carrieres
   gagnees, la Legende est FERMEE — un cadenas et le compte, rien a toucher.
   Sur le canal de test, `?legende=99` l'ouvre (compte.ts, legendeForcee). */

export function ChoixDeCarriere({ ouverte, onChoisir }:
  { ouverte: boolean; onChoisir: (c: ChoixCarriere) => void }) {
  const k = carrieresGagnees();
  const carte = 'w-full rounded-2xl border-2 px-4 py-4 md:py-5 flex items-center gap-3 text-left shadow-2xl';
  return (
    <div className="w-full flex flex-col gap-2 md:gap-3">
      <button onClick={() => onChoisir('classique')}
              className={`${carte} bg-card/80 backdrop-blur-xl border-primary/60 hover:bg-primary/10 transition-colors`}>
        <Medal size={26} className="shrink-0 text-primary" />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="font-black font-display text-xl md:text-2xl tracking-wide text-primary leading-tight">
            {mot('classique_titre')}
          </span>
          <span className="text-[11px] md:text-sm text-foreground/65 leading-snug">{mot('classique_sous')}</span>
        </span>
        <ChevronRight size={20} className="shrink-0 text-primary/80" />
      </button>

      {ouverte ? (
        <button onClick={() => onChoisir('legende')}
                className={`${carte} hover:brightness-125 transition-[filter]`}
                style={{ borderColor: OR, background: 'linear-gradient(160deg, #2A1C40F2, #0B0A1AE6)', boxShadow: `0 0 26px ${OR}33` }}>
          <Crown size={26} color={OR} className="shrink-0" />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="font-black font-display text-xl md:text-2xl tracking-wide leading-tight" style={{ color: OR }}>
              {mot('titre')}
            </span>
            <span className="text-[11px] md:text-sm text-foreground/65 leading-snug">{mot('sous')}</span>
          </span>
          <ChevronRight size={20} color={OR} className="shrink-0" />
        </button>
      ) : (
        // FERMEE : pas un bouton, rien ne s'y passe au toucher.
        <div aria-disabled className={`${carte} relative overflow-hidden cursor-default`}
             style={{ borderColor: `${OR}45`, background: 'linear-gradient(160deg, #1B1230CC, #0B0A1AB3)' }}>
          <Lock size={24} color={`${OR}AA`} className="shrink-0" />
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="font-black font-display text-xl md:text-2xl tracking-wide leading-tight" style={{ color: `${OR}BB` }}>
              {mot('titre')}
            </span>
            <span className="text-[11px] md:text-sm text-foreground/60 leading-snug">{mot('ferme', { n: CARRIERES_REQUISES })}</span>
            <span className="text-xs md:text-sm font-bold tabular-nums mt-1" style={{ color: OR }}>
              {mot('victoires', { k: Math.min(k, CARRIERES_REQUISES), n: CARRIERES_REQUISES })}
            </span>
          </span>
          <span className="absolute left-0 bottom-0 h-1.5 w-full bg-white/10">
            <span className="block h-full" style={{ width: `${Math.min(100, (100 * k) / CARRIERES_REQUISES)}%`, background: OR }} />
          </span>
        </div>
      )}
    </div>
  );
}

/** En tete du mode choisi : revenir aux deux cartes. */
export function RetourAuChoix({ mode, onRetour }: { mode: ChoixCarriere; onRetour: () => void }) {
  const legende = mode === 'legende';
  return (
    <button onClick={onRetour}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10
                       hover:bg-white/10 transition-colors text-left">
      <ChevronLeft size={16} className="shrink-0 text-foreground/70" />
      <span className="text-[10px] md:text-xs font-bold tracking-widest text-foreground/60">{mot('changer')}</span>
      <span className="flex-1 min-w-0 text-right text-[10px] md:text-xs font-black tracking-widest truncate"
            style={{ color: legende ? OR : undefined }}>
        <span className={legende ? '' : 'text-primary'}>{legende ? mot('titre') : mot('classique_titre')}</span>
      </span>
    </button>
  );
}

/* ===========================================================================
   APRES LES 30 : LE PANNEAU DE LA LEGENDE, QUAND ON LA CHOISIT
   ===========================================================================
   A cote de la carriere classique, pas a sa place (l'auteur, 07/10/2026).
   Meme ossature que la carriere classique — une carte de
   ce qu'on a fait, puis le gros bouton —, mais la carte est l'echelle des six
   etapes : ou l'on court, contre qui, et le meilleur chrono gagnant de chacune.
   Le 100 m seulement : pas de selecteur d'epreuve. */

export function PanneauLegende() {
  const [annonce, setAnnonce] = useState(false);
  const m = memoire();
  const commencer = (depuis = 0) => { commencerLaLegende(depuis); setAnnonce(true); };

  return (
    <>
      <div className="rounded-2xl p-3 md:p-5 shadow-2xl flex flex-col gap-2 md:gap-3 border"
           style={{ borderColor: `${OR}80`, background: 'linear-gradient(160deg, #1B1230F2, #0B0A1AE6)' }}>
        <div className="flex items-center gap-2">
          <Crown size={16} color={OR} className="shrink-0" />
          <h2 className="flex-1 min-w-0 font-bold tracking-widest text-[11px] md:text-sm leading-tight" style={{ color: OR }}>
            {mot('titre')}
          </h2>
          <span className="shrink-0 px-2 py-1 rounded-md text-[9px] font-black tracking-widest text-black" style={{ background: OR }}>
            100 M
          </span>
        </div>

        <div className="flex flex-col gap-1">
          {ETAPES.map((e, i) => {
            const Icone = ICONES[e.transport];
            const atteinte = i <= m.plusLoin;
            // Le meilleur chrono gagnant de l'etape, tous lieux tires confondus.
            const meilleurs = e.lieux.map(l => m.meilleurs[l.cle]).filter((t): t is number => !!t);
            const meilleur = meilleurs.length ? Math.min(...meilleurs) : null;
            const lieux = e.lieux.length > 1 ? e.lieux.map(l => l.nom).join(' · ') : e.lieux[0].nom;
            const bosses = e.lieux.map(l => l.boss).join(' · ');
            return (
              <div key={i} className={`flex items-center gap-2 rounded-md px-2 py-1.5 border border-white/5 bg-black/25
                                       ${atteinte ? '' : 'opacity-45'}`}>
                <span className="w-5 shrink-0 text-[11px] font-black tabular-nums" style={{ color: TEINTES[i] }}>{i + 1}</span>
                <Icone size={13} color={TEINTES[i]} className="shrink-0" />
                <span className="flex-1 min-w-0 flex flex-col leading-tight">
                  <span className="text-[11px] md:text-sm font-bold text-foreground truncate">{lieux}</span>
                  <span className="text-[9px] md:text-[11px] text-foreground/55 truncate">{bosses}</span>
                </span>
                <span className="shrink-0 font-mono text-[11px] md:text-sm font-bold"
                      style={{ color: meilleur ? TEINTES[i] : 'rgba(255,255,255,0.35)' }}>
                  {meilleur ? chrono(meilleur) : '—'}
                </span>
              </div>
            );
          })}
        </div>

        <p className="text-[10px] md:text-xs text-center text-foreground/55 leading-snug">
          {[mot('regle_perte'), m.accomplies ? mot('accomplies', { n: m.accomplies }) : ''].filter(Boolean).join(' · ')}
        </p>

        {/* LE CANAL DE TEST PART D'OU IL VEUT : six boutons pour essayer une
            etape sans courir celles d'avant. Ce fichier n'existe que la. */}
        <div className="flex items-center justify-center gap-1.5">
          <span className="text-[8px] font-bold tracking-[0.18em] text-white/45 mr-1">{mot('essai')}</span>
          {ETAPES.map((_, i) => (
            <button key={i} onClick={() => commencer(i)}
                    className="w-6 h-6 rounded-md text-[10px] font-black text-white border hover:bg-white/10"
                    style={{ borderColor: `${TEINTES[i]}88` }}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      <button onClick={() => commencer(0)}
              className="w-full py-3 md:py-5 rounded-xl font-black font-display text-xl md:text-2xl tracking-widest text-black
                         transition-all border-b-4 active:border-b-0 active:translate-y-1"
              style={{ background: OR, borderColor: '#9A7424', boxShadow: `0 0 30px ${OR}55` }}>
        {mot('commencer')}
      </button>

      <AnimatePresence>
        {annonce && <Affiche onPartir={() => { setAnnonce(false); lancerLEtape(); }}
                             onFermer={() => { setAnnonce(false); rangerLaLegende(); }} />}
      </AnimatePresence>
    </>
  );
}

/* ===========================================================================
   L'AFFICHE, AVANT CHAQUE ETAPE — le joueur contre le boss
   =========================================================================== */

// PAR UN PORTAIL, SUR LE CORPS DE LA PAGE. La banderole vit dans la colonne
// de l'accueil, ou chaque carte anime sa montee par une transformation : une
// transformation fait de son element un contexte d'empilement, et un enfant
// `fixed` n'en sort plus — les cartes suivantes se peignaient par-dessus
// l'affiche, z-50 ou pas (vu a l'ecran le 06/10).
function Affiche(props: { onPartir: () => void; onFermer: () => void }) {
  return createPortal(<AfficheVS {...props} />, document.body);
}

function AfficheVS({ onPartir, onFermer }: { onPartir: () => void; onFermer: () => void }) {
  const rang = rangEnCours();
  const e = ETAPES[rang];
  const lieu = lieuDeLEtape(rang);
  const depuis = rang === 0 ? 'San-Pédro' : lieuDeLEtape(rang - 1).nom;
  const teinte = TEINTES[rang];
  const Icone = ICONES[e.transport];
  const drapeau = drapeauDe(lieu.drapeau);
  // Le voyage passe entre l'affiche et la course : a velo, en voiture, en car,
  // en avion (LegendeCinematiques.tsx), la montee vers Karman
  // (LegendeKarman.tsx), puis vers l'apotheose.
  const [voyage, setVoyage] = useState(false);
  const partir = () => setVoyage(true);

  return (
    // OPAQUE : l'affiche est un ecran a part entiere, pas un voile sur
    // l'accueil — les cartes de l'accueil se lisaient encore au travers.
    <motion.div {...VOILE}
                className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center overflow-y-auto py-6
                           px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
                style={{ background: `radial-gradient(130% 70% at 50% 42%, ${teinte}30, #07050F 72%), #07050F` }}>
      <motion.div {...PANNEAU} className="w-full max-w-md flex flex-col items-center gap-4 text-center">
        <span className="text-[10px] font-bold tracking-[0.28em]" style={{ color: teinte }}>
          {mot('etape', { n: rang + 1 })} · {dans(e.intitule).toUpperCase()}
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="font-black font-display text-3xl sm:text-4xl uppercase tracking-tight leading-[0.95] text-white">
            {drapeau && <span className="mr-2">{drapeau}</span>}{lieu.nom}
          </span>
          <span className="text-xs text-white/60">{lieu.pays}</span>
        </div>
        <CarteDuVoyage rang={rang} teinte={teinte} boss={lieu.boss} />
        <span className="flex items-center gap-2 text-[11px] text-white/70">
          <Icone size={16} color={teinte} />
          {mot('depuis', { t: mot(e.transport), d: depuis })}
        </span>

        {/* LE VS. Le boss a la place d'honneur, a droite, dans sa couleur. */}
        <div className="w-full grid grid-cols-[1fr_auto_1fr] items-center gap-2 mt-1">
          <div className="rounded-2xl border border-white/15 bg-white/5 py-4 px-2 flex flex-col items-center min-w-0">
            {getSavedName() && <span className="text-[10px] tracking-[0.22em] text-white/55">{mot('toi')}</span>}
            <span className="font-black font-display text-xl leading-tight text-white uppercase truncate max-w-full">
              {getSavedName() || mot('toi')}
            </span>
          </div>
          <span className="font-black font-display text-3xl italic" style={{ color: teinte }}>{mot('contre')}</span>
          <div className="rounded-2xl border-2 pb-4 pt-2 px-2 flex flex-col items-center overflow-hidden"
               style={{ borderColor: `${teinte}CC`, background: `linear-gradient(160deg, ${teinte}33, #0E0A1A)` }}>
            {PORTRAITS[lieu.boss] && (
              <img src={PORTRAITS[lieu.boss]} alt="" className="w-24 h-24 object-cover object-top rounded-xl mb-1"
                   style={{ background: `radial-gradient(circle at 50% 35%, ${teinte}55, #0A0C18)` }} />
            )}
            <span className="text-[10px] font-bold tracking-[0.18em]" style={{ color: teinte }}>
              « {dans(lieu.surnom).toUpperCase()} »
            </span>
            <span className="font-black font-display text-xl leading-tight text-white uppercase">{lieu.boss}</span>
            <span className="text-[10px] text-white/60 mt-0.5">{mot('a_battre', { s: chrono(chronoDuBoss(rang)) })}</span>
          </div>
        </div>

        <div className="w-full flex gap-2 mt-2">
          <button onClick={partir}
                  className="flex-1 py-3 rounded-xl font-black tracking-widest text-sm text-black hover:opacity-90 transition-opacity"
                  style={{ background: teinte }}>
            {mot('partir')}
          </button>
          <button onClick={onFermer}
                  className="px-4 py-3 rounded-xl font-bold tracking-widest text-sm text-white border border-white/25 hover:bg-white/10 transition-colors">
            {mot('accueil')}
          </button>
        </div>
      </motion.div>
      {voyage && (rang === 4 ? <CinematiqueKarman lieu={lieu.cle} onFin={onPartir} />
                : rang === 5 ? <CinematiqueApotheose onFin={onPartir} />
                : <CinematiqueVoyage rang={rang} onFin={onPartir} />)}
    </motion.div>
  );
}

/* ===========================================================================
   LA PRESENTATION DU BOSS, PENDANT SON ENTREE
   ===========================================================================
   Le bandeau des jeux de combat : son drapeau et sa ville, son nom en grand,
   son surnom dans la couleur de l'etape, et deux lignes sur lui. Il glisse
   pendant que le boss fait son entree (game/legende/entrees.ts) et s'en va
   quand le decompte part. Sa replique, elle, est dans la bulle au-dessus de
   lui (drawBulle). */

export function PresentationBoss() {
  const [visible, setVisible] = useState(false);
  const [parle, setParle] = useState(false);
  React.useEffect(() => {
    // L'entree vit dans la boucle du jeu, pas dans React : on la relit.
    const id = window.setInterval(() => {
      const G = (SprinterApp as any).G;
      const avD = G.avantDepart;
      setVisible(!!(avD && avD.entree && avD.reste > 0 && (avD.t || 0) > 0.3));
      setParle(!!G.presBulle);
    }, 100);
    return () => window.clearInterval(id);
  }, []);
  const rang = rangEnCours();
  const lieu = lieuDeLEtape(rang);
  const teinte = TEINTES[rang];
  const drapeau = drapeauDe(lieu.drapeau);
  // Sa replique est dans la bulle, dans sa langue ; sa traduction vient ici,
  // le temps qu'il parle — sauf s'il parle deja la langue du joueur.
  const trad = dans([lieu.replique.fr, lieu.replique.en]);
  const traduction = parle && lieu.replique.vo && lieu.replique.vo !== trad ? trad : '';
  return (
    <AnimatePresence>
      {visible && (
        <motion.div key="presentation"
                    initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute left-0 right-0 bottom-[18%] z-20 pointer-events-none
                               px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
          <div className="max-w-md rounded-2xl border-l-4 px-4 py-3 shadow-2xl flex gap-3 items-start"
               style={{ borderColor: teinte, background: 'linear-gradient(100deg, rgba(10,8,22,0.92), rgba(10,8,22,0.55))' }}>
            {PORTRAITS[lieu.boss] && (
              <img src={PORTRAITS[lieu.boss]} alt="" className="w-16 h-16 shrink-0 object-cover object-top rounded-xl"
                   style={{ background: `radial-gradient(circle at 50% 35%, ${teinte}55, #0A0C18)` }} />
            )}
            <div className="min-w-0">
            <div className="text-[10px] font-bold tracking-[0.24em] text-white/70">
              {drapeau && <span className="mr-1.5">{drapeau}</span>}
              {lieu.pays.toUpperCase()}
            </div>
            <div className="font-black font-display text-3xl leading-[0.95] uppercase text-white">{lieu.boss}</div>
            <div className="text-sm font-black italic tracking-wide" style={{ color: teinte }}>
              « {dans(lieu.surnom).toUpperCase()} »
            </div>
            <div className="mt-1 text-[11px] leading-snug text-white/75">{dans(lieu.bio)}</div>
            {traduction && (
              <div className="mt-1 text-[12px] leading-snug italic text-white">« {traduction} »</div>
            )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ===========================================================================
   LA FIN D'UNE ETAPE
   =========================================================================== */

export function FinDEtapeLegende() {
  const state = useGameStore(s => s.state);
  // LE VERDICT SE RANGE UNE SEULE FOIS, au montage (conclureLEtape est
  // d'ailleurs sans effet a la seconde lecture d'une meme course).
  const [v] = useState<Verdict>(() => conclureLEtape());
  const [annonce, setAnnonce] = useState(false);
  // la Legende accomplie : le sacre passe avant le verdict
  const [sacre, setSacre] = useState(() => v.accomplie);
  if (state !== 'winall') return null;

  const teinte = TEINTES[v.rang];
  const titre = v.moi === null ? mot('faux')
              : v.accomplie ? mot('accomplie')
              : v.gagne ? mot('gagnee') : mot('perdue');
  const ecart = v.moi !== null && v.tBoss !== null ? v.tBoss - v.moi : null;
  const ord = (n: number) => {
    const N = (globalThis as any).SprinterI18N;
    return N && N.ord ? N.ord(n) : String(n);
  };

  const accueil = () => { rangerLaLegende(); (SprinterApp as any).goHome(); };
  const suivante = () => { if (etapeSuivante()) setAnnonce(true); };
  const recommencer = () => { commencerLaLegende(0); setAnnonce(true); };

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center
                    bg-[rgba(8,5,16,0.88)] px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} className="w-full max-w-md flex flex-col items-center gap-3 text-center">
        <span className="text-[10px] font-bold tracking-[0.28em]" style={{ color: teinte }}>
          {mot('etape', { n: v.rang + 1 })} · {v.lieu.nom.toUpperCase()}
        </span>
        <span className={`font-black font-display text-3xl sm:text-4xl uppercase tracking-tight leading-[0.95]
                          ${v.gagne ? 'text-white' : 'text-destructive'}`}>
          {titre}
        </span>
        {v.moi !== null && <span className="text-sm text-white/70">{mot('place', { o: ord(v.place) })}</span>}

        <div className="w-full grid grid-cols-2 gap-2 font-mono tabular-nums">
          <div className="rounded-xl bg-white/5 border border-white/10 py-2">
            <div className="text-[10px] tracking-widest text-white/55">{mot('toi')}</div>
            <div className="text-xl font-bold text-white">{chrono(v.moi)}</div>
          </div>
          <div className="rounded-xl border py-2" style={{ background: `${teinte}22`, borderColor: `${teinte}55` }}>
            <div className="text-[10px] tracking-widest uppercase" style={{ color: teinte }}>{v.boss}</div>
            <div className="text-xl font-bold text-white">{chrono(v.tBoss)}</div>
          </div>
        </div>
        {ecart !== null && (
          <span className="text-sm text-white/75">
            {ecart > 0 ? mot('avance', { s: chrono(ecart), b: v.boss }) : mot('retard', { s: chrono(-ecart), b: v.boss })}
          </span>
        )}
        {!v.gagne && <span className="text-[11px] text-white/55">{mot('regle_perte')}</span>}

        <div className="w-full flex gap-2 mt-1">
          {v.gagne && !v.accomplie && (
            <button onClick={suivante}
                    className="flex-1 py-3 rounded-xl font-black tracking-widest text-sm text-black hover:opacity-90 transition-opacity"
                    style={{ background: TEINTES[Math.min(5, v.rang + 1)] }}>
              {mot('suivante')}
            </button>
          )}
          {!v.gagne && (
            <button onClick={recommencer}
                    className="flex-1 py-3 rounded-xl font-black tracking-widest text-sm text-black bg-white hover:bg-white/90 transition-colors">
              {mot('recommencer')}
            </button>
          )}
          <button onClick={accueil}
                  className={`${v.accomplie ? 'flex-1' : 'px-4'} py-3 rounded-xl font-bold tracking-widest text-sm text-white border border-white/25 hover:bg-white/10 transition-colors`}>
            {mot('accueil')}
          </button>
        </div>
      </motion.div>
      {sacre && <CinematiqueSacre onFin={() => setSacre(false)} />}
      <AnimatePresence>
        {annonce && <Affiche onPartir={() => { setAnnonce(false); lancerLEtape(); }} onFermer={() => { setAnnonce(false); accueil(); }} />}
      </AnimatePresence>
    </div>
  );
}
