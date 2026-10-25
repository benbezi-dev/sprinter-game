import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Footprints, ChevronRight, ChevronLeft, X, Trophy, Wallet, HeartPulse, BatteryMedium,
  Briefcase, ShoppingBag, Users, BookOpen, Flag, Star, Smartphone,
} from 'lucide-react';
import { PANNEAU } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  type Athlete, type Jour, type Stat, type Epreuve, type Origine, type Voie,
  STATS, JOURS, EPREUVES, BOULOTS, MATERIEL, COMPETITIONS, SEANCES, NIVEAU_OBJECTIF, ecart,
  nouvelAthlete, seancePossible, faireLaSeance, prendreUnBoulot, achatPossible, acheter,
  bonusMateriel, coutDuDeplacement, picDeForme,
  type Seance as ResultatSeance, type Resultat,
} from '@/game/athlete/regles';
import { evenement, repondre } from '@/game/athlete/recit';
import {
  charger, sauver, semaineSuivante, partirALaCompetition, conclureLaCourse,
  chargerCalendrier, jourDeLAthlete, forfait,
  rangerLaCourse, aRouvrir, demanderReouverture,
} from '@/game/athlete/carriere';
import { mot, dans, seanceDuJour, lang } from '@/game/athlete/mots';

/* ---------------------------------------------------------------------------
   LA CARRIERE D'ATHLETE — les ecrans du mode
   ---------------------------------------------------------------------------
   L'AVENTURE ET L'ARCADE. Le tableau de bord est l'aventure : la semaine, le
   club, l'argent, ce qu'on te demande. Les seances et les competitions sont
   l'arcade : une seance est un mini-jeu d'appuis alternes, une competition
   une vraie course du moteur, avec le corps de l'athlete pose sur le coureur
   (game/athlete/regles.ts, `reglages`).

   CANAL DE TEST SEULEMENT. Ce fichier n'est atteint que par des `lazy`
   (TitleScreen.tsx, App.tsx) derriere `CARRIERE_ATHLETE_OUVERTE && ...`.
--------------------------------------------------------------------------- */

const VERT = '#3DDC84';

/** Une date reelle, courte : « sam. 14 nov., 18:00 ». */
const quand = (t: number) => new Date(t).toLocaleString(lang() === 'en' ? 'en-GB' : 'fr-FR',
  { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const ord = (n: number) => {
  const N = (globalThis as any).SprinterI18N;
  return N && N.ord ? N.ord(n) : String(n);
};

/** L'athlete en memoire pour la visite : le meme objet pour tous les ecrans. */
let courant: Athlete | null | undefined;
function athlete(): Athlete | null {
  if (courant === undefined) courant = charger();
  return courant;
}

/* ===========================================================================
   DANS L'ONGLET CARRIERE
   =========================================================================== */

/** La troisieme carte du choix de l'onglet CARRIERE. */
export function CarteAthlete({ onChoisir }: { onChoisir: () => void }) {
  return (
    <button onClick={onChoisir}
            className="w-full rounded-2xl border-2 px-4 py-4 md:py-5 flex items-center gap-3 text-left shadow-2xl
                       hover:brightness-125 transition-[filter]"
            style={{ borderColor: VERT, background: 'linear-gradient(160deg, #0F2A1EF2, #0A1410E6)', boxShadow: `0 0 22px ${VERT}26` }}>
      <Footprints size={26} color={VERT} className="shrink-0" />
      <span className="flex-1 min-w-0 flex flex-col">
        <span className="font-black font-display text-xl md:text-2xl tracking-wide leading-tight" style={{ color: VERT }}>
          {mot('titre')}
        </span>
        <span className="text-[11px] md:text-sm text-foreground/65 leading-snug">{mot('sous')}</span>
      </span>
      <ChevronRight size={20} color={VERT} className="shrink-0" />
    </button>
  );
}

/** En tete du mode : revenir aux cartes. */
export function RetourAthlete({ onRetour }: { onRetour: () => void }) {
  return (
    <button onClick={onRetour}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-black/60 backdrop-blur-md border border-white/10
                       hover:bg-white/10 transition-colors text-left">
      <ChevronLeft size={16} className="shrink-0 text-foreground/70" />
      <span className="flex-1 min-w-0 text-right text-[10px] md:text-xs font-black tracking-widest truncate" style={{ color: VERT }}>
        {mot('titre')}
      </span>
    </button>
  );
}

/** Le panneau de l'onglet : creer l'athlete, ou ouvrir sa carriere. */
export function PanneauAthlete() {
  const [a, setA] = useState<Athlete | null>(() => athlete());
  const [ouvert, setOuvert] = useState(() => !!athlete() && aRouvrir());
  const [creation, setCreation] = useState(false);

  const cree = (n: Athlete) => { courant = n; sauver(n); setA(n); setCreation(false); setOuvert(true); };
  const efface = () => { courant = null; sauver(null); setA(null); setOuvert(false); };

  return (
    <>
      <div className="rounded-2xl p-3 md:p-5 shadow-2xl flex flex-col gap-2 md:gap-3 border"
           style={{ borderColor: `${VERT}80`, background: 'linear-gradient(160deg, #0F2A1EF2, #0A1410E6)' }}>
        {a ? (
          <>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-black font-display text-lg tracking-wide truncate" style={{ color: VERT }}>{a.nom}</span>
              <span className="text-[10px] font-bold tracking-widest text-white/60">{mot('semaine', { n: a.semaine })}</span>
            </div>
            <div className="text-xs text-white/70">
              {mot(COMPETITIONS[a.niveau].cle)} · {mot('argent', { n: a.argent })}
              {a.club ? ` · ${mot(a.club)}` : ''}
            </div>
            <Barres a={a} compact />
          </>
        ) : (
          <p className="text-xs md:text-sm text-white/70 leading-snug">{mot('sous')}</p>
        )}
      </div>
      <button onClick={() => (a ? setOuvert(true) : setCreation(true))}
              className="w-full rounded-2xl py-4 font-black font-display text-xl tracking-wider text-black shadow-2xl
                         hover:brightness-110 transition-[filter]"
              style={{ background: VERT, boxShadow: `0 0 30px ${VERT}55` }}>
        {a ? mot('ouvrir') : mot('creer')}
      </button>
      {creation && <Creation onFini={cree} onFermer={() => setCreation(false)} />}
      {ouvert && a && <TableauDeBord a={a} onFermer={() => setOuvert(false)} onEffacer={efface} />}
    </>
  );
}

/* ===========================================================================
   LES MORCEAUX COMMUNS
   =========================================================================== */

function Voile({ children }: { children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-[rgba(5,9,8,0.99)] text-foreground
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1.5rem)]">
      <motion.div {...PANNEAU} className="w-full max-w-lg mx-auto flex flex-col gap-3">{children}</motion.div>
    </div>,
    document.body,
  );
}

function Carte({ titre, icone: Icone, children }:
  { titre?: string; icone?: typeof Flag; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 flex flex-col gap-2">
      {titre && (
        <h3 className="flex items-center gap-2 text-[10px] font-black tracking-[0.22em] text-white/60">
          {Icone && <Icone size={13} />} {titre}
        </h3>
      )}
      {children}
    </section>
  );
}

function Jauge({ v, couleur, max = 100 }: { v: number; couleur: string; max?: number }) {
  return (
    <span className="block h-1.5 w-full rounded-full bg-white/10 overflow-hidden">
      <span className="block h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, (100 * v) / max))}%`, background: couleur }} />
    </span>
  );
}

const COULEUR: Record<Stat, string> = { vitesse: '#FF5A5F', force: '#F5A623', technique: '#4AA8FF', endurance: VERT };

function Barres({ a, compact = false }: { a: Athlete; compact?: boolean }) {
  const m = bonusMateriel(a);
  return (
    <div className={`grid ${compact ? 'grid-cols-2 gap-x-3 gap-y-1' : 'grid-cols-1 gap-2'}`}>
      {STATS.map(s => (
        <div key={s} className="flex flex-col gap-0.5">
          <span className="flex justify-between text-[10px] font-bold tracking-wider text-white/70">
            <span>{mot(s).toUpperCase()}</span>
            <span className="tabular-nums">
              {Math.floor(a.stats[s])}{m[s] ? <span className="text-white/45"> +{m[s]}</span> : null}
              {!compact && <span className="text-white/35"> / {COMPETITIONS[a.niveau].plafond}</span>}
            </span>
          </span>
          <Jauge v={a.stats[s]} couleur={COULEUR[s]} />
        </div>
      ))}
    </div>
  );
}

function Bouton({ onClick, disabled, children, plein = false, className = '' }:
  { onClick?: () => void; disabled?: boolean; children: React.ReactNode; plein?: boolean; className?: string }) {
  return (
    <button onClick={onClick} disabled={disabled}
            className={`rounded-xl px-3 py-2 text-xs font-black tracking-widest transition-[filter,opacity]
                        disabled:opacity-35 disabled:cursor-not-allowed hover:enabled:brightness-125 ${plein ? 'text-black' : 'text-white border border-white/20 bg-white/5'} ${className}`}
            style={plein ? { background: VERT } : undefined}>
      {children}
    </button>
  );
}

/* ===========================================================================
   LA CREATION
   =========================================================================== */

function Creation({ onFini, onFermer }: { onFini: (a: Athlete) => void; onFermer: () => void }) {
  const [origine, setOrigine] = useState<Origine | null>(null);
  const [voie, setVoie] = useState<Voie | null>(null);
  const [spe, setSpe] = useState<Epreuve>('100');
  const choix = (actif: boolean) =>
    `w-full text-left rounded-2xl border-2 p-3 transition-colors ${actif ? 'bg-white/10' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07]'}`;

  return (
    <Voile>
      <div className="flex items-center justify-between">
        <h2 className="font-black font-display text-2xl tracking-wide" style={{ color: VERT }}>{mot('titre')}</h2>
        <button onClick={onFermer} aria-label={mot('fermer')} className="p-2 text-white/70 hover:text-white"><X size={20} /></button>
      </div>

      <Carte titre={mot('famille')}>
        {(['aisee', 'modeste'] as Origine[]).map(o => (
          <button key={o} onClick={() => setOrigine(o)} className={choix(origine === o)}
                  style={origine === o ? { borderColor: VERT } : undefined}>
            <span className="block font-black text-sm">{mot(o)}</span>
            <span className="block text-xs text-white/65 leading-snug">{mot(`${o}_d`)}</span>
          </button>
        ))}
      </Carte>

      <Carte titre={mot('voie')}>
        {(['polyvalent', 'specialiste'] as Voie[]).map(v => (
          <button key={v} onClick={() => setVoie(v)} className={choix(voie === v)}
                  style={voie === v ? { borderColor: VERT } : undefined}>
            <span className="block font-black text-sm">{mot(v)}</span>
            <span className="block text-xs text-white/65 leading-snug">{mot(`${v}_d`)}</span>
          </button>
        ))}
        {voie === 'specialiste' && (
          <div className="flex gap-2">
            {EPREUVES.map(e => (
              <Bouton key={e} plein={spe === e} onClick={() => setSpe(e)} className="flex-1">{e} m</Bouton>
            ))}
          </div>
        )}
      </Carte>

      <Bouton plein disabled={!origine || !voie} className="py-4 text-base"
              onClick={() => origine && voie && onFini(nouvelAthlete(getSavedName() || 'TOI', origine, voie, spe))}>
        {mot('lancer')}
      </Bouton>
    </Voile>
  );
}

/* ===========================================================================
   LE TABLEAU DE BORD : LA SEMAINE
   =========================================================================== */

function TableauDeBord({ a, onFermer, onEffacer }: { a: Athlete; onFermer: () => void; onEffacer: () => void }) {
  const [, maj] = useReducer((x: number) => x + 1, 0);
  const [seance, setSeance] = useState<Jour | null>(null);
  const [boutique, setBoutique] = useState(false);
  const [efface, setEfface] = useState(false);
  const [epreuve, setEpreuve] = useState<Epreuve>(a.specialite || '100');
  const changer = (f: () => void) => { f(); sauver(a); maj(); };
  // les vrais championnats : a partir de la France, la competition se cale sur eux
  useEffect(() => { chargerCalendrier().then(maj); }, []);

  const comp = COMPETITIONS[a.niveau];
  const { jour: leJour, date: direct } = jourDeLAthlete(a);
  const cout = coutDuDeplacement(a, a.niveau);
  const payable = a.argent >= cout;
  const ev = evenement(a.evenement);

  const courir = () => {
    if (!partirALaCompetition(a, a.specialite || epreuve)) return;
    // la course part : l'accueil se demonte, et la fin de course rouvrira ici
    demanderReouverture();
  };

  return (
    <Voile>
      {/* l'en-tete */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="font-black font-display text-2xl tracking-wide truncate" style={{ color: VERT }}>{a.nom}</h2>
          <p className="text-[10px] font-bold tracking-widest text-white/60">
            {mot('semaine', { n: a.semaine })}
            {a.specialite ? ` · ${a.specialite} m` : ` · ${mot('polyvalent').toUpperCase()}`}
            {a.club ? ` · ${mot(a.club).toUpperCase()}` : ''}
          </p>
        </div>
        <button onClick={onFermer} aria-label={mot('fermer')} className="p-2 text-white/70 hover:text-white"><X size={20} /></button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2 flex flex-col gap-1">
          <span className="flex items-center gap-1 text-white/60"><Wallet size={12} /> €</span>
          <span className="font-black tabular-nums text-base">{mot('argent', { n: a.argent })}</span>
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2 flex flex-col gap-1">
          <span className="flex items-center gap-1 text-white/60"><BatteryMedium size={12} /> {mot('fatigue')}</span>
          <span className="font-black tabular-nums">{Math.round(a.fatigue)}</span>
          <Jauge v={a.fatigue} couleur={a.fatigue >= 85 ? '#FF5A5F' : a.fatigue >= 60 ? '#F5A623' : VERT} />
        </div>
        <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2 flex flex-col gap-1">
          <span className="flex items-center gap-1 text-white/60"><HeartPulse size={12} /> {mot('moral')}</span>
          <span className="font-black tabular-nums">{Math.round(a.moral)}</span>
          <Jauge v={a.moral} couleur="#C58BFF" />
        </div>
      </div>

      <Carte><Barres a={a} /></Carte>

      {/* la competition */}
      <Carte titre={mot('competition')} icone={Trophy}>
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-black text-sm">{mot(comp.cle)}</span>
          <span className="text-[10px] font-bold tracking-widest" style={{ color: leJour ? VERT : undefined }}>
            {leJour ? mot('ce_dimanche') : direct ? quand(direct) : mot('dans', { n: a.prochaine - a.semaine })}
          </span>
        </div>
        {direct && <p className="text-[11px] font-bold" style={{ color: VERT }}>{mot('direct')}</p>}
        {a.objectif && (
          <p className="text-[11px] text-white/60">
            {mot('objectif', { o: mot(COMPETITIONS[NIVEAU_OBJECTIF[a.objectif]].cle) })} · {mot('assiduite', { f: a.assiduite.faites, p: a.assiduite.proposees })}
            {picDeForme(a, a.niveau) && <span className="ml-1 font-black" style={{ color: VERT }}>· {mot('pic')}</span>}
          </p>
        )}
        {leJour && (
          <>
            <p className="text-[11px] text-white/60">
              {cout === 0 ? mot('paye') : mot('deplacement', { n: cout })}
              {!payable && <span className="text-red-400"> · {mot('pas_moyens')}</span>}
            </p>
            {!a.specialite && (
              <div className="flex gap-2">
                {EPREUVES.map(e => <Bouton key={e} plein={epreuve === e} onClick={() => setEpreuve(e)} className="flex-1">{e} m</Bouton>)}
              </div>
            )}
            <div className="flex gap-2">
              <Bouton plein className="flex-1 py-3 text-sm" disabled={!payable || a.blessure > 0 || !!ev} onClick={courir}>
                {mot('courir')} · {a.specialite || epreuve} m
              </Bouton>
              <Bouton disabled={!!ev} onClick={() => changer(() => forfait(a))}>{mot('forfait')}</Bouton>
            </div>
          </>
        )}
      </Carte>

      {/* la semaine */}
      <Carte titre={mot('semaine', { n: a.semaine })} icone={Flag}>
        {!a.coach && <p className="text-[11px] text-white/50">{mot('seul')}</p>}
        {JOURS.map(j => {
          const raison = seancePossible(a, j);
          return (
            <div key={j} className="flex items-center gap-2">
              <span className="w-1 self-stretch rounded-full" style={{ background: COULEUR[SEANCES[j].stat] }} />
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-[10px] font-black tracking-widest text-white/70">
                  {mot(j)} · {mot(SEANCES[j].stat).toUpperCase()}
                </span>
                <span className="text-xs text-white/80 truncate">{seanceDuJour(j, a.semaine, !!a.coach)}</span>
              </span>
              {raison
                ? <span className="text-[10px] font-black tracking-widest text-white/40">
                    {raison === 'faite' ? mot('faite') : raison === 'blesse' ? mot('blesse') : mot('pris')}
                  </span>
                : <Bouton plein disabled={!!ev} onClick={() => setSeance(j)}>{mot('sentrainer')}</Bouton>}
            </div>
          );
        })}
        <div className="flex items-center gap-2 opacity-60">
          <span className="w-1 self-stretch rounded-full bg-white/20" />
          <span className="flex-1 text-[10px] font-black tracking-widest text-white/70">
            {mot('dimanche')} · {leJour ? mot('competition') : mot('repos').toUpperCase()}
          </span>
        </div>
        <Bouton className="py-3 mt-1" disabled={leJour || !!ev} onClick={() => changer(() => semaineSuivante(a))}>
          {mot('fin_semaine')}
        </Bouton>
      </Carte>

      {/* l'argent */}
      <Carte titre={mot('boulots')} icone={Briefcase}>
        {a.boulot ? <p className="text-xs text-white/60">{mot('boulot_pris')}</p> : (
          <div className="grid grid-cols-3 gap-2">
            {BOULOTS.map(b => (
              <button key={b.id} disabled={!!ev || (!!b.prend && a.faites.includes(b.prend))}
                      onClick={() => changer(() => { prendreUnBoulot(a, b.id); })}
                      className="rounded-xl border border-white/15 bg-white/5 p-2 text-left disabled:opacity-35 hover:enabled:bg-white/10">
                <span className="block text-xs font-black">{mot(b.id)}</span>
                <span className="block text-[10px] text-white/60">+{b.gain} € · {mot('fatigue').toLowerCase()} +{b.fatigue}</span>
                {b.prend && <span className="block text-[10px] text-amber-300/80">{mot('prend_samedi')}</span>}
              </button>
            ))}
          </div>
        )}
      </Carte>

      <Carte titre={mot('boutique')} icone={ShoppingBag}>
        {!boutique ? <Bouton onClick={() => setBoutique(true)}>{mot('boutique')} ›</Bouton> : MATERIEL.map(p => {
          const r = achatPossible(a, p.id);
          if (r === 'avant') return null;
          const effets = [
            p.course && Object.entries(p.course).map(([k, v]) => `${mot(k)} +${v}`).join(', ') + ` ${mot('en_course')}`,
            p.seance && mot('seance_plus', { j: mot(p.seance).split(' ')[0].toLowerCase() }),
            p.recup && mot('recup_d', { n: p.recup }),
          ].filter(Boolean).join(' · ');
          return (
            <div key={p.id} className="flex items-center gap-2">
              <span className="flex-1 min-w-0 flex flex-col">
                <span className="text-xs font-black">{mot(p.id)}</span>
                <span className="text-[10px] text-white/55">{effets}</span>
              </span>
              {r === 'possede'
                ? <span className="text-[10px] font-black tracking-widest" style={{ color: VERT }}>{mot('possede')}</span>
                : <Bouton disabled={!!r} onClick={() => changer(() => { acheter(a, p.id); })}>{p.prix} €</Bouton>}
            </div>
          );
        })}
      </Carte>

      {/* le club, la reputation */}
      <Carte titre={mot('club')} icone={Users}>
        <p className="text-xs">{a.club ? `${mot(a.club)} · ${mot(a.coach || '')}` : mot('sans_club')}</p>
        {a.club && (
          <div className="grid grid-cols-3 gap-2">
            {(['coach', 'club', 'rival'] as const).map(k => (
              <div key={k} className="flex flex-col gap-0.5">
                <span className="text-[10px] font-bold text-white/60">{mot(`rel_${k}`)} {a.relations[k] > 0 ? '+' : ''}{a.relations[k]}</span>
                <Jauge v={a.relations[k] + 100} max={200} couleur={a.relations[k] >= 0 ? VERT : '#FF5A5F'} />
              </div>
            ))}
          </div>
        )}
        <p className="flex flex-wrap gap-x-3 text-[11px] text-white/60">
          <span className="flex items-center gap-1"><Star size={11} /> {mot('reputation', { n: a.reputation })}</span>
          <span className="flex items-center gap-1"><Smartphone size={11} /> {mot('abonnes', { n: a.abonnes })}</span>
          {a.sponsors.length > 0 && <span>{mot('sponsors', { n: a.sponsors.length })}</span>}
        </p>
      </Carte>

      {a.palmares.length > 0 && (
        <Carte titre={mot('palmares')} icone={Trophy}>
          {a.palmares.slice(0, 6).map((p, i) => (
            <p key={i} className="text-xs text-white/75 flex justify-between gap-2">
              <span className="truncate">{mot(COMPETITIONS[p.niveau].cle)} · {p.epreuve} m</span>
              <span className="tabular-nums shrink-0">
                {p.chrono === null ? mot('faux') : `${mot('place', { o: ord(p.place) })} · ${p.chrono.toFixed(2)}`}
              </span>
            </p>
          ))}
        </Carte>
      )}

      {a.journal.length > 0 && (
        <Carte titre={mot('journal')} icone={BookOpen}>
          {a.journal.slice(0, 8).map((l, i) => (
            <p key={i} className="text-[11px] text-white/60 leading-snug">
              <span className="text-white/35 tabular-nums">S{l.s} · </span>{dans([l.fr, l.en])}
            </p>
          ))}
        </Carte>
      )}

      <div className="flex items-center justify-center gap-2 pt-2 text-[11px] text-white/45">
        {!efface ? <button onClick={() => setEfface(true)} className="underline">{mot('recommencer')}</button> : <>
          <span>{mot('sur')}</span>
          <button onClick={onEffacer} className="font-black text-red-400">{mot('oui')}</button>
          <button onClick={() => setEfface(false)} className="font-black text-white/70">{mot('non')}</button>
        </>}
      </div>

      {ev && <Dialogue a={a} onRepondu={() => { sauver(a); maj(); }} />}
      {seance && (
        <SeanceJeu jour={seance} a={a}
                   onFin={() => { setSeance(null); sauver(a); maj(); }} />
      )}
    </Voile>
  );
}

/* ===========================================================================
   L'HISTOIRE : CE QU'ON TE DIT, CE QUE TU REPONDS
   =========================================================================== */

function Dialogue({ a, onRepondu }: { a: Athlete; onRepondu: () => void }) {
  const ev = evenement(a.evenement);
  if (!ev) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-black/70
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <motion.div {...PANNEAU} key={ev.id}
                  className="w-full max-w-md rounded-2xl border p-4 flex flex-col gap-3 shadow-2xl"
                  style={{ borderColor: `${VERT}80`, background: 'linear-gradient(160deg, #10251CF7, #0A1410F7)' }}>
        <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: VERT }}>{dans(ev.qui).toUpperCase()}</span>
        <p className="text-sm leading-relaxed text-white/90">{dans(ev.texte(a))}</p>
        <div className="flex flex-col gap-2">
          {ev.choix.map((c, i) => {
            const ok = !c.possible || c.possible(a);
            return (
              <button key={i} disabled={!ok} onClick={() => { if (repondre(a, i)) onRepondu(); }}
                      className="text-left rounded-xl border border-white/15 bg-white/5 px-3 py-2 disabled:opacity-35
                                 hover:enabled:bg-white/10 transition-colors">
                <span className="block text-sm font-bold">{dans(c.t)}</span>
                {c.d && <span className="block text-[11px] text-white/55">{dans(c.d)}</span>}
              </button>
            );
          })}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/* ===========================================================================
   LA SEANCE : L'ARCADE DE L'ENTRAINEMENT
   ===========================================================================
   Quatre jeux d'appuis alternes, un par jour, qui mesurent ce que la seance
   travaille. Le geste est celui de la course — gauche, droite, ou les deux
   zones —, et deux appuis du meme cote sont une faute.

     frequence  6 s   le plus d'appuis alternes possible
     charge    10 s   tenir une cadence haute (la fin compte autant que le debut)
     rythme     8 s   un appui par battement, gauche puis droite
     tempo     16 s   rester dans la zone de 5 a 8 appuis par seconde

   Le score va de 0 a 1 ; regles.ts en fait des points de stats. */

const DUREE = { frequence: 6, charge: 10, rythme: 8, tempo: 16 } as const;
const BATTEMENT = 0.4;
const ZONE: [number, number] = [5, 8];

type Appui = { t: number; cote: 'g' | 'd'; bon: boolean };

function noterLaSeance(jeu: keyof typeof DUREE, appuis: Appui[]): number {
  const d = DUREE[jeu];
  const bons = appuis.filter(x => x.bon);
  const fautes = appuis.length - bons.length;
  const borne = (v: number) => Math.max(0, Math.min(1, v));
  if (jeu === 'frequence') return borne((bons.length / d - 4) / 7 - fautes * 0.02);
  if (jeu === 'charge') {
    // la seconde moitie pese autant que la premiere : on juge la plus faible
    const a = bons.filter(x => x.t < d / 2).length, b = bons.length - a;
    return borne((Math.min(a, b) / (d / 2) - 3) / 6 - fautes * 0.02);
  }
  if (jeu === 'rythme') {
    let touches = 0, n = 0;
    for (let k = 1; k * BATTEMENT <= d - 0.2; k++, n++) {
      const t = k * BATTEMENT, cote = k % 2 ? 'g' : 'd';
      if (appuis.some(x => x.cote === cote && Math.abs(x.t - t) <= 0.1)) touches++;
    }
    return borne(n ? touches / n - fautes * 0.01 : 0);
  }
  // tempo : la cadence glissante sur une seconde, relevee tous les dixiemes
  let dedans = 0, total = 0;
  for (let t = 1; t <= d; t += 0.1, total++) {
    const r = bons.filter(x => x.t > t - 1 && x.t <= t).length;
    if (r >= ZONE[0] && r <= ZONE[1]) dedans++;
  }
  return borne(total ? dedans / total : 0);
}

function SeanceJeu({ jour, a, onFin }: { jour: Jour; a: Athlete; onFin: () => void }) {
  const jeu = SEANCES[jour].jeu;
  const duree = DUREE[jeu];
  const [phase, setPhase] = useState<'pret' | 'jeu' | 'fini'>('pret');
  const [t, setT] = useState(0);
  const [res, setRes] = useState<{ score: number; r: ResultatSeance | null } | null>(null);
  const appuis = useRef<Appui[]>([]);
  const debut = useRef(0);
  const dernier = useRef<'g' | 'd' | null>(null);
  const [, maj] = useReducer((x: number) => x + 1, 0);

  const appui = (cote: 'g' | 'd') => {
    if (phase !== 'jeu') return;
    const tt = (performance.now() - debut.current) / 1000;
    appuis.current.push({ t: tt, cote, bon: dernier.current !== cote });
    dernier.current = cote;
    maj();
  };

  // le clavier, comme en course
  useEffect(() => {
    if (phase !== 'jeu') return;
    const k = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); appui('g'); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); appui('d'); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  });

  // l'horloge de la seance
  useEffect(() => {
    if (phase !== 'jeu') return;
    let id = 0;
    const tic = () => {
      const tt = (performance.now() - debut.current) / 1000;
      if (tt >= duree) {
        const score = noterLaSeance(jeu, appuis.current);
        const r = faireLaSeance(a, jour, score, Math.random);
        setRes({ score, r });
        setPhase('fini');
        return;
      }
      setT(tt);
      id = requestAnimationFrame(tic);
    };
    id = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(id);
  }, [phase]);

  const partir = () => { appuis.current = []; dernier.current = null; debut.current = performance.now(); setT(0); setPhase('jeu'); };

  const bons = appuis.current.filter(x => x.bon);
  const cadence = bons.filter(x => x.t > t - 1).length;
  const prochain = Math.ceil(t / BATTEMENT) * BATTEMENT;
  const pulse = jeu === 'rythme' && phase === 'jeu' && prochain - t < 0.08;
  const attendu = Math.round(prochain / BATTEMENT) % 2 ? 'g' : 'd';

  return createPortal(
    <div className="fixed inset-0 z-[85] flex flex-col bg-[rgba(4,8,7,0.98)] text-foreground select-none touch-none">
      <div className="px-4 pt-[max(env(safe-area-inset-top),1rem)] flex flex-col gap-2 max-w-lg w-full mx-auto">
        <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: COULEUR[SEANCES[jour].stat] }}>
          {mot(jour)} · {mot(SEANCES[jour].stat).toUpperCase()}
        </span>
        <h2 className="font-black font-display text-xl leading-tight">{seanceDuJour(jour, a.semaine, !!a.coach)}</h2>
        <p className="text-xs text-white/65">{mot(`${jeu}_d`)}</p>
        <Jauge v={t} max={duree} couleur={COULEUR[SEANCES[jour].stat]} />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center gap-3 px-4">
        {phase === 'pret' && (
          <>
            <p className="text-sm text-white/70 text-center max-w-xs">{mot('pret')}</p>
            <Bouton plein className="px-10 py-4 text-xl" onClick={partir}>{mot('go')}</Bouton>
          </>
        )}
        {phase === 'jeu' && (
          <>
            <span className="font-black font-display text-6xl tabular-nums">{bons.length}</span>
            <span className="text-sm font-bold tabular-nums"
                  style={{ color: jeu === 'tempo' ? (cadence >= ZONE[0] && cadence <= ZONE[1] ? VERT : '#FF5A5F') : undefined }}>
              {mot('appuis', { n: cadence })}
            </span>
            {jeu === 'rythme' && (
              <span className="w-16 h-16 rounded-full border-4 transition-transform"
                    style={{ borderColor: VERT, transform: `scale(${pulse ? 1.25 : 0.85})`,
                             background: pulse ? `${VERT}55` : 'transparent' }}>
                <span className="flex h-full items-center justify-center text-[10px] font-black">
                  {attendu === 'g' ? mot('gauche') : mot('droite')}
                </span>
              </span>
            )}
          </>
        )}
        {phase === 'fini' && res && (
          <div className="flex flex-col items-center gap-2 text-center">
            <span className="font-black font-display text-3xl">{mot('score', { n: Math.round(res.score * 100) })}</span>
            {res.r?.blessure
              ? <span className="text-red-400 font-bold">{mot('blessure_s')}</span>
              : res.r && (
                <div className="flex gap-3">
                  {Object.entries(res.r.gains).map(([k, v]) => (
                    <span key={k} className="font-black" style={{ color: COULEUR[k as Stat] }}>{mot(k)} +{v}</span>
                  ))}
                </div>
              )}
            <Bouton plein className="px-8 py-3 mt-2" onClick={onFin}>{mot('continuer')}</Bouton>
          </div>
        )}
      </div>

      {/* les deux zones, comme en course */}
      {phase === 'jeu' && (
        <div className="grid grid-cols-2 gap-2 p-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] h-[38vh]">
          {(['g', 'd'] as const).map(c => (
            <button key={c} onPointerDown={e => { e.preventDefault(); appui(c); }}
                    className="rounded-2xl border-2 border-white/15 bg-white/[0.06] active:bg-white/20 font-black tracking-widest text-white/50">
              {c === 'g' ? '←' : '→'}
            </button>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}

/* ===========================================================================
   LA FIN D'UNE COMPETITION (App.tsx, a l'etiquette `athlete`)
   =========================================================================== */

export function FinDeCourseAthlete() {
  const state = useGameStore(s => s.state);
  const [r] = useState<Resultat | null>(() => { const a = athlete(); return a ? conclureLaCourse(a) : null; });
  if (state !== 'winall') return null;

  const retour = () => {
    rangerLaCourse();
    demanderReouverture();
    (SprinterApp as any).goHome();
  };
  const suivant = r && r.qualifie ? COMPETITIONS[r.niveau + 1] : null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center
                    bg-[rgba(4,10,8,0.9)] px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} className="w-full max-w-md flex flex-col items-center gap-3 text-center">
        {r && (
          <>
            <span className="text-[10px] font-bold tracking-[0.28em]" style={{ color: VERT }}>
              {mot(COMPETITIONS[r.niveau].cle).toUpperCase()} · {r.epreuve} M
            </span>
            <span className={`font-black font-display text-3xl sm:text-4xl uppercase tracking-tight leading-[0.95]
                              ${r.chrono !== null && r.place <= 3 ? 'text-white' : 'text-destructive'}`}>
              {r.sommet ? mot('sommet') : r.chrono === null ? mot('faux') : mot('place', { o: ord(r.place) })}
            </span>
            {r.chrono !== null && <span className="font-black tabular-nums text-xl">{r.chrono.toFixed(2)} s</span>}
            <span className="text-sm" style={{ color: suivant ? VERT : undefined }}>
              {suivant ? mot('qualifie', { c: mot(suivant.cle) }) : !r.sommet ? mot('pas_qualifie', { n: ecart(r.niveau) }) : null}
            </span>
            <span className="text-xs text-white/60">
              {r.prime > 0 && `${mot('prime', { n: r.prime })} · `}{mot('rep_plus', { n: r.reputation })}
            </span>
          </>
        )}
        <Bouton plein className="px-8 py-3 mt-2" onClick={retour}>{mot('retour_carriere')}</Bouton>
      </motion.div>
    </div>
  );
}
