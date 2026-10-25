import React, { useEffect, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Footprints, ChevronRight, ChevronLeft, X, Trophy, Wallet, HeartPulse, BatteryMedium,
  Briefcase, ShoppingBag, Users, BookOpen, Flag, Star, Smartphone, MapPin, RotateCcw, RotateCw,
  Zap, Utensils, ShowerHead, MessageCircle, Smile, Pause, Play, FastForward,
} from 'lucide-react';
import { PANNEAU } from '@/lib/mouvement';
import { SprinterApp, useGameStore } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  type Athlete, type Jour, type Stat, type Epreuve, type Origine, type Voie,
  STATS, JOURS, EPREUVES, BOULOTS, MATERIEL, COMPETITIONS, SEANCES, NIVEAU_OBJECTIF, ecart,
  nouvelAthlete, seancePossible, faireLaSeance, prendreUnBoulot, achatPossible, acheter,
  bonusMateriel, coutDuDeplacement, picDeForme,
  type Resultat, type Apparence, APPARENCE, CORPS, PEAUX, COIFFURES, CHEVEUX, COULEURS,
  exerciceDuJour, lieuDeLExercice, chezLeKine, prixDuKine, footingAuParc,
  type Besoin, BESOINS, ACTIONS, actionPossible, seanceMaintenant, besoinsDe, jourDe, heureDe, avancer, DIMANCHE,
  etape, categorie, LOYER, SALAIRE, payer, BLESSURES, usureDe, SEUIL_BLESSURE, NOMS_ZONES, ZONES, SEUIL_GENE, type Zone, chargeDe,
} from '@/game/athlete/regles';
import { evenement, repondre } from '@/game/athlete/recit';
import {
  charger, sauver, semaineSuivante, partirALaCompetition, conclureLaCourse,
  chargerCalendrier, jourDeLAthlete, forfait, agir,
  rangerLaCourse, aRouvrir, demanderReouverture,
} from '@/game/athlete/carriere';
import { mot, dans, seanceDuJour, lang, EXOS } from '@/game/athlete/mots';
import { lookDe, apparenceDe, lookDePersonne } from '@/game/athlete/apparence';
import { type Personne, GENS, PERSONNES, ouEst, lienDe, etiquette, interactionsAvec, interagir, roleDe } from '@/game/athlete/gens';
import { Ville, LIEUX, type Lieu } from '@/game/athlete/ville';
import { Telephone, type App } from './TelephoneAthlete';
import { type Mode, voyager, nonLus, messagesDuReveil, messagesDeBienvenue } from '@/game/athlete/telephone';
import { SeanceJeu } from './SeancesAthlete';
import { nomDuClub, logoDuClub, CLUB_PARTENAIRE } from '@/game/athlete/partenaires';
import { type Soin, etatDeSante, soigner, soinPossible, resteACharge, certificatRequis, EXAMEN } from '@/game/athlete/sante';

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
/** « place » est feminin : la 1re place, pas « 1er place ». */
const ordPlace = (n: number) => (n === 1 ? dans(['1re', ord(1)]) : ord(n));

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

  // le premier matin, le telephone a deja ses messages (telephone.ts)
  const cree = (n: Athlete) => { messagesDeBienvenue(n); messagesDuReveil(n); courant = n; sauver(n); setA(n); setCreation(false); setOuvert(true); };
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
              {a.club ? ` · ${nomDuClub(a.club, mot(a.club))}` : ''}
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
   L'APPARENCE : LE CORPS QU'ON SE CHOISIT
   =========================================================================== */

const NOMS_COIFFURES: Record<string, [string, string]> = {
  crop: ['Court', 'Crop'], fade: ['Dégradé', 'Fade'], ras: ['Ras', 'Buzz'], flattop: ['Flat-top', 'Flat-top'],
  twists: ['Twists', 'Twists'], braids: ['Tresses', 'Braids'], ponytail: ['Queue de cheval', 'Ponytail'],
  bun: ['Chignon', 'Bun'], shaved: ['Crâne rasé', 'Shaved'],
};
const TEINTES_CHEVEUX: Record<string, string> = { noir: '#1C1616', brun: '#382418', chatain: '#5C3E24', blond: '#BC9A58', roux: '#944A26', gris: '#B0B0B6' };
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const PEAUX_RGB: Record<string, number[]> = {
  ebene: [74, 46, 32], cacao: [96, 60, 40], acajou: [108, 66, 42], noisette: [120, 76, 50], bronze: [142, 92, 58],
  ambre: [176, 122, 78], miel: [198, 150, 104], olive: [206, 166, 118], sable: [224, 186, 142], clair: [238, 204, 166], porcelaine: [246, 220, 190],
};

/** Le personnage qui tourne lentement sur lui-meme, en tenue de ville. */
function Apercu({ ap, haut = 260 }: { ap: Apparence; haut?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    cv.width = Math.round(haut * 0.8 * dpr); cv.height = Math.round(haut * dpr);
    const c = cv.getContext('2d')!, A = SprinterApp as any;
    const corps = { look: lookDe(ap, true), stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0, marche: 0, marcheT: 0 };
    let id = 0;
    const tic = (t: number) => {
      c.clearRect(0, 0, cv.width, cv.height);
      const k = cv.height * 0.47;
      A.drawFacetFigure(c, A.personCapsules(corps, -Math.PI / 2 + Math.sin(t / 1400) * 1.2, 0, false, false, A.niveauDetail(k)), cv.width / 2, cv.height * 0.96, k);
      id = requestAnimationFrame(tic);
    };
    id = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(id);
  }, [ap, haut]);
  return <canvas ref={ref} style={{ height: haut, width: haut * 0.8 }} className="mx-auto block" />;
}

function ChoixApparence({ ap, onChange }: { ap: Apparence; onChange: (a: Apparence) => void }) {
  const pastille = (actif: boolean) => `w-8 h-8 rounded-full border-2 ${actif ? 'border-white scale-110' : 'border-white/20'} transition-transform`;
  const ligne = 'flex flex-wrap gap-2 items-center';
  return (
    <div className="flex flex-col gap-3">
      <div className="rounded-2xl bg-gradient-to-b from-[#BFE0F5] to-[#8DBF77]"><Apercu ap={ap} /></div>
      <div className={ligne}>
        {CORPS.map(c => <Bouton key={c} plein={ap.corps === c} onClick={() => onChange({ ...ap, corps: c })} className="flex-1">
          {c === 'f' ? dans(['Fille', 'Girl']) : dans(['Garçon', 'Boy'])}</Bouton>)}
      </div>
      <span className="text-[10px] font-black tracking-[0.22em] text-white/60">{dans(['PEAU', 'SKIN'])}</span>
      <div className={ligne}>
        {PEAUX.map(p => <button key={p} aria-label={p} onClick={() => onChange({ ...ap, peau: p })} className={pastille(ap.peau === p)} style={{ background: rgb(PEAUX_RGB[p]) }} />)}
      </div>
      <span className="text-[10px] font-black tracking-[0.22em] text-white/60">{dans(['COIFFURE', 'HAIR'])}</span>
      <div className={ligne}>
        {COIFFURES.map(h => <Bouton key={h} plein={ap.coiffure === h} onClick={() => onChange({ ...ap, coiffure: h })}>{dans(NOMS_COIFFURES[h])}</Bouton>)}
      </div>
      <div className={ligne}>
        {CHEVEUX.map(h => <button key={h} aria-label={h} onClick={() => onChange({ ...ap, cheveux: h })} className={pastille(ap.cheveux === h)} style={{ background: TEINTES_CHEVEUX[h] }} />)}
      </div>
      <span className="text-[10px] font-black tracking-[0.22em] text-white/60">{dans(['TAILLE', 'HEIGHT'])} · {ap.taille.toFixed(2)} m</span>
      <input type="range" min={1.55} max={2} step={0.01} value={ap.taille} onChange={e => onChange({ ...ap, taille: +e.target.value })} className="w-full accent-[#3DDC84]" />
      <span className="text-[10px] font-black tracking-[0.22em] text-white/60">{dans(['TES COULEURS', 'YOUR COLOURS'])}</span>
      <div className={ligne}>
        {COULEURS.map((c, i) => <button key={i} aria-label={`couleur ${i + 1}`} onClick={() => onChange({ ...ap, couleur: i })} className={pastille(ap.couleur === i)} style={{ background: rgb(c) }} />)}
      </div>
    </div>
  );
}

/* ===========================================================================
   LA CREATION
   =========================================================================== */

function Creation({ onFini, onFermer }: { onFini: (a: Athlete) => void; onFermer: () => void }) {
  const [etape, setEtape] = useState<'corps' | 'vie'>('corps');
  const [ap, setAp] = useState<Apparence>(APPARENCE);
  const [origine, setOrigine] = useState<Origine | null>(null);
  const [voie, setVoie] = useState<Voie | null>(null);
  const [spe, setSpe] = useState<Epreuve>('100');
  const [age, setAge] = useState(14);
  const vie = age <= 14 ? dans(['Collège · chez tes parents · compétition scolaire', 'Secondary school · living with parents · school meet'])
    : age <= 17 ? dans(['Lycée · chez tes parents', 'High school · living with parents'])
    : dans(['Vie active · ton appart, un loyer, un travail · départementaux d’entrée', 'Working life · your own flat, rent, a job · straight to county level']);
  const choix = (actif: boolean) =>
    `w-full text-left rounded-2xl border-2 p-3 transition-colors ${actif ? 'bg-white/10' : 'bg-white/[0.03] border-white/10 hover:bg-white/[0.07]'}`;

  return (
    <Voile>
      <div className="flex items-center justify-between">
        <h2 className="font-black font-display text-2xl tracking-wide" style={{ color: VERT }}>{mot('titre')}</h2>
        <button onClick={onFermer} aria-label={mot('fermer')} className="p-2 text-white/70 hover:text-white"><X size={20} /></button>
      </div>

      {etape === 'corps' ? (
        <>
          <Carte titre={dans(['TON ATHLÈTE', 'YOUR ATHLETE'])}><ChoixApparence ap={ap} onChange={setAp} /></Carte>
          <Bouton plein className="py-4 text-base" onClick={() => setEtape('vie')}>{dans(['SUIVANT', 'NEXT'])} ›</Bouton>
        </>
      ) : (
        <>
          <Carte titre={dans(['TON ÂGE', 'YOUR AGE'])}>
            <div className="flex items-baseline justify-between">
              <span className="font-black font-display text-3xl tabular-nums">{age} {dans(['ans', 'yrs'])}</span>
              <span className="text-[11px] font-black tracking-widest" style={{ color: VERT }}>{dans(categorie(age)).toUpperCase()}</span>
            </div>
            <input type="range" min={12} max={35} step={1} value={age} onChange={e => setAge(+e.target.value)} className="w-full accent-[#3DDC84]" aria-label={dans(['Âge', 'Age'])} />
            <p className="text-xs text-white/65">{vie}</p>
          </Carte>
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
                {EPREUVES.map(e => <Bouton key={e} plein={spe === e} onClick={() => setSpe(e)} className="flex-1">{e} m</Bouton>)}
              </div>
            )}
          </Carte>
          <div className="flex gap-2">
            <Bouton onClick={() => setEtape('corps')}>‹</Bouton>
            <Bouton plein disabled={!origine || !voie} className="flex-1 py-4 text-base"
                    onClick={() => origine && voie && onFini(nouvelAthlete(getSavedName() || 'TOI', origine, voie, spe, ap, age))}>
              {mot('lancer')}
            </Bouton>
          </div>
        </>
      )}
    </Voile>
  );
}

/* ===========================================================================
   LA VILLE : LA VIE DE LA SEMAINE, LIEU PAR LIEU
   ===========================================================================
   L'athlete se promene dans Val-de-Reuil (game/athlete/ville.ts). Arriver a
   une porte ouvre le lieu : on y fait ce qu'on y fait dans la vraie vie. Les
   seances se font la ou l'exercice se fait (lieuDeLExercice) ; la competition
   part de la gare ; on dort a la maison, ce qui fait tourner la semaine. */

const NOMS_LIEUX: Record<Lieu, [string, string]> = {
  maison: ['Maison', 'Home'], college: ['Collège', 'School'], lycee: ['Lycée', 'High school'],
  stade: ['Stade', 'Stadium'], club_quartier: ['Les Foulées du Quartier', 'Les Foulées du Quartier'],
  club_horizon: ['Horizon Athlétisme', 'Horizon Athletics'], kine: ['Espace santé', 'Health centre'],
  boutique: ['Magasin de sport', 'Sports shop'], marche: ['Marché', 'Market'], livraison: ['Pizzeria', 'Pizzeria'],
  babysitting: ['Les voisins', 'Neighbours'], gare: ['Gare', 'Station'], cote: ['La côte', 'The hill'],
  parc: ['Parc', 'Park'], piscine: ['Piscine', 'Pool'], mairie: ['Mairie', 'Town hall'],
  travail: ['Ton travail', 'Your job'], parents: ['Chez tes parents', 'Your parents’ home'],
};
/** Le nom d'un lieu ; pour un adulte, la maison est son appartement. */
const nomLieu = (l: Lieu, a?: Athlete) => (l === 'maison' && a && etape(a) === 'adulte' ? dans(['Ton appart', 'Your flat'])
  : l === 'club_quartier' && CLUB_PARTENAIRE ? CLUB_PARTENAIRE.court : dans(NOMS_LIEUX[l]));
const PRIX_VELO = 120;
const NOMS_JOURS: [string, string][] = [['Lundi', 'Monday'], ['Mardi', 'Tuesday'], ['Mercredi', 'Wednesday'], ['Jeudi', 'Thursday'], ['Vendredi', 'Friday'], ['Samedi', 'Saturday'], ['Dimanche', 'Sunday']];
const nomDuJour = (j: number) => dans(NOMS_JOURS[j]);
const horloge = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
const NOMS_BESOINS: Record<Besoin, [string, string]> = {
  energie: ['Énergie', 'Energy'], faim: ['Faim', 'Hunger'], hygiene: ['Hygiène', 'Hygiene'], social: ['Social', 'Social'], plaisir: ['Plaisir', 'Fun'],
};
const ICONES_BESOINS: Record<Besoin, typeof Zap> = { energie: Zap, faim: Utensils, hygiene: ShowerHead, social: MessageCircle, plaisir: Smile };
const NOMS_ACTIONS: Record<string, [string, string]> = {
  dormir: ['Dormir jusqu’au matin', 'Sleep till morning'], sieste: ['Faire une sieste', 'Take a nap'], manger: ['Manger en famille', 'Eat with the family'],
  douche: ['Prendre une douche', 'Have a shower'], devoirs: ['Faire ses devoirs', 'Do homework'], console: ['Jouer à la console', 'Play video games'],
  telephone: ['Appeler un ami', 'Call a friend'], cours: ['Aller en cours', 'Go to class'], cours_lycee: ['Aller en cours', 'Go to class'],
  echauffement: ['S’échauffer : gammes, accélérations', 'Warm up: drills, strides'], travail: ['Aller travailler', 'Go to work'], manger_parents: ['Manger avec tes parents', 'Eat with your parents'], pizza: ['Manger une pizza', 'Eat a pizza'],
  fruits: ['Acheter des fruits', 'Buy fruit'], discuter_parc: ['Discuter sur un banc', 'Chat on a bench'], discuter_club: ['Discuter avec le groupe', 'Chat with the squad'],
};
const RAISONS: Record<string, [string, string]> = {
  heure: ['Pas à cette heure', 'Not at this time'], argent: ['Pas assez d’argent', 'Not enough money'], fait: ['Déjà fait', 'Already done'],
  'week-end': ['Pas le week-end', 'Not at weekends'], etape: ['Pas à ton âge', 'Not at your age'], pas_ce_jour: ['Pas aujourd’hui', 'Not today'], pas_l_heure: ['Après les cours : 16 h 30 – 21 h (samedi 9 h – 19 h)', 'After school: 4:30–9 pm (Saturday 9 am–7 pm)'],
};
const effetsTexte = (e: Partial<Record<Besoin, number>>) =>
  Object.entries(e).filter(([, v]) => v).map(([k, v]) => `${dans(NOMS_BESOINS[k as Besoin])} ${v! > 0 ? '+' : ''}${v}`).join(' · ');

function noterEpuise(a: Athlete) {
  a.moral = Math.max(0, a.moral - 6);
  a.journal.unshift({ s: a.semaine, fr: 'Épuisé : tu t’es endormi en rentrant.', en: 'Exhausted: you fell asleep on the way home.' });
}

/** Les actions de la journee qu'on peut faire dans ce lieu. */
function Actions({ a, lieu, ev, changer }: { a: Athlete; lieu: string; ev: boolean; changer: (f: () => void) => void }) {
  // ce qui ne concerne pas l'age (le college a 25 ans) n'apparait pas
  const liste = ACTIONS.filter(x => x.lieu === lieu && actionPossible(a, x.id) !== 'etape');
  if (!liste.length) return null;
  return (
    <Carte titre={dans(['FAIRE', 'DO'])}>
      {liste.map(x => {
        const r = actionPossible(a, x.id);
        const duree = x.duree === 'nuit' ? dans(['la nuit', 'overnight']) : x.duree === 'cours' ? (x.id === 'travail' ? dans([`jusqu’à 17 h · +${SALAIRE} €`, `till 5 pm · +€${SALAIRE}`]) : dans(['jusqu’à 16 h 30', 'till 4:30 pm'])) : `${x.duree} min`;
        return (
          <div key={x.id} className="flex items-center gap-2">
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-xs font-black">{dans(NOMS_ACTIONS[x.id] || [x.id, x.id])}</span>
              <span className="text-[10px] text-white/55">{duree}{x.cout ? ` · ${x.cout} €` : ''}{effetsTexte(x.effets) ? ` · ${effetsTexte(x.effets)}` : ''}</span>
              {r && <span className="text-[10px] text-amber-300/80">{dans(RAISONS[r])}</span>}
            </span>
            <Bouton plein disabled={!!r || ev} onClick={() => changer(() => { agir(a, x.id); })}>{dans(['OK', 'GO'])}</Bouton>
          </div>
        );
      })}
    </Carte>
  );
}
const BOULOT_DU_LIEU: Partial<Record<Lieu, string>> = { marche: 'marche', livraison: 'livraison', babysitting: 'babysitting' };
/** Le temps que prend chaque petit boulot, en minutes. */
const DUREE_BOULOT: Record<string, number> = { babysitting: 180, livraison: 120, marche: 240 };
const lieuDuClub = (a: Athlete): Lieu | null => (a.club === 'horizon' ? 'club_horizon' : a.club === 'quartier' ? 'club_quartier' : null);

function TableauDeBord({ a, onFermer, onEffacer }: { a: Athlete; onFermer: () => void; onEffacer: () => void }) {
  const [, maj] = useReducer((x: number) => x + 1, 0);
  const [seance, setSeance] = useState<Jour | null>(null);
  const [lieu, setLieu] = useState<Lieu | null>(null);
  // le telephone : ferme (null), ou l'appli ouverte ; et le lieu a montrer sur la carte
  const [tel, setTel] = useState<App | null>(null);
  const [personne, setPersonne] = useState<Personne | null>(null);
  const [pret, setPret] = useState(false);
  // la vitesse du temps : minutes de jeu par seconde (0 : pause), comme les Sims
  const [vitesse, setVitesse] = useState(1);
  const hote = useRef<HTMLDivElement>(null);
  const ville = useRef<Ville | null>(null);
  const changer = (f: () => void) => { f(); sauver(a); maj(); };

  // la ville : construite une fois, detruite en sortant
  useEffect(() => {
    if (!hote.current) return;
    const v = new Ville(hote.current, {
      look: lookDe(apparenceDe(a), true),
      depart: a.position || null,
      nom: l => nomLieu(l, a),
      adulte: etape(a) === 'adulte',
      surLieu: l => setLieu(l),
      surPosition: p => { a.position = p; },
      surPret: () => setPret(true),
      surPersonne: id => { setLieu(null); setTel(null); setPersonne(id as Personne); },
    });
    ville.current = v;
    return () => { sauver(a); v.detruire(); ville.current = null; };
  }, []);
  useEffect(() => { chargerCalendrier().then(maj); }, []);

  const ev = evenement(a.evenement);
  // la ville se fige tant qu'un lieu, une seance, un dialogue ou le menu est ouvert
  useEffect(() => { ville.current?.pause(!!(lieu || seance || ev || tel || personne)); }, [lieu, seance, ev, tel, personne]);

  // LE TEMPS QUI PASSE : une seconde, `vitesse` minutes ; rien ne bouge
  // pendant qu'un lieu, une seance, un dialogue ou le menu est ouvert.
  const fige = !!(lieu || seance || ev || tel || personne);
  // l'heure, et qui est ou a cette heure-la (gens.ts)
  useEffect(() => {
    ville.current?.heure(heureDe(a));
    ville.current?.gens(PERSONNES.flatMap(p => {
      const l = ouEst(a, p);
      return l ? [{ id: p, nom: dans(GENS[p].nom(a)), lieu: l as Lieu, look: lookDePersonne(a, p) }] : [];
    }));
  });
  useEffect(() => {
    if (fige || !vitesse || !pret) return;
    let n = 0;
    const id = setInterval(() => {
      const quoi = avancer(a, vitesse);
      ville.current?.heure(heureDe(a));
      // plus d'energie : on rentre se coucher, comme un Sim qui s'effondre
      if (quoi.includes('epuise')) {
        noterEpuise(a);
        ville.current?.filerA('maison');
        agir(a, 'dormir');
      }
      if (++n % 10 === 0) sauver(a);
      maj();
    }, 1000);
    return () => clearInterval(id);
  }, [fige, vitesse, pret]);

  const comp = COMPETITIONS[a.niveau];
  const { jour: leJour, date: direct, cetteSemaine } = jourDeLAthlete(a);
  // partir vers un lieu : a pied on y marche dans la ville ; a velo ou en bus on y est,
  // le temps du trajet passe et le ticket se paie (telephone.ts, trajet)
  const aller = (l: Lieu, mode: Mode = 'pied') => {
    setLieu(null); setTel(null);
    if (mode === 'pied') { ville.current?.allerA(l); return; }
    if (voyager(a, mode, Math.round((ville.current?.distance(l) || 0) * 1.3))) return;
    sauver(a);
    ville.current?.filerA(l);
  };

  return createPortal(
    <div className="fixed inset-0 z-[70] bg-[#A9D3F0] text-foreground select-none">
      <div ref={hote} className="absolute inset-0 overflow-hidden" />
      {!pret && <div className="absolute inset-0 flex items-center justify-center bg-[#0A1410] text-white/70 text-sm">
        {dans(['Val-de-Reuil se dessine…', 'Drawing Val-de-Reuil…'])}</div>}

      {/* le bandeau du haut : qui, quand, combien */}
      <div className="absolute top-0 inset-x-0 px-[max(env(safe-area-inset-left),0.5rem)] pr-[max(env(safe-area-inset-right),0.5rem)] pt-[max(env(safe-area-inset-top),0.5rem)] pointer-events-none">
        <div className="flex items-start gap-2 pointer-events-auto">
          <div className="flex-1 min-w-0 rounded-2xl bg-[rgba(8,18,14,0.86)] backdrop-blur px-3 py-2 shadow-xl">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-black font-display text-base truncate" style={{ color: VERT }}>{a.nom}</span>
              <span className="text-[10px] font-bold tracking-widest text-white/60 shrink-0">{mot('semaine', { n: a.semaine })}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-0.5">
              <span className="font-black tabular-nums text-sm text-white">{nomDuJour(jourDe(a))} {horloge(heureDe(a))}</span>
              <span className="flex gap-1">
                {[0, 1, 3, 10].map(v => (
                  <button key={v} onClick={() => setVitesse(v)} aria-label={v ? `×${v}` : 'pause'}
                          className={`w-7 h-6 rounded-md flex items-center justify-center ${vitesse === v ? 'text-black' : 'text-white/70 bg-white/10'}`}
                          style={vitesse === v ? { background: VERT } : undefined}>
                    {v === 0 ? <Pause size={12} /> : v === 1 ? <Play size={12} /> : v === 3 ? <FastForward size={12} /> : <span className="text-[9px] font-black">×10</span>}
                  </button>
                ))}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-1 text-[10px] text-white/70">
              <span className="flex items-center gap-1 tabular-nums"><Wallet size={11} /> {mot('argent', { n: a.argent })}</span>
              <span className="flex flex-col gap-0.5"><span className="flex items-center gap-1"><BatteryMedium size={11} /> {Math.round(a.fatigue)}</span>
                <Jauge v={a.fatigue} couleur={a.fatigue >= 85 ? '#FF5A5F' : a.fatigue >= 60 ? '#F5A623' : VERT} /></span>
              <span className="flex flex-col gap-0.5"><span className="flex items-center gap-1"><HeartPulse size={11} /> {Math.round(a.moral)}</span>
                <Jauge v={a.moral} couleur="#C58BFF" /></span>
            </div>
            {etatDeSante(a) && (
              <button onClick={() => aller('kine')} className={`mt-1.5 w-full rounded-lg px-2 py-1 text-[10px] font-black text-left truncate ${etatDeSante(a)!.grave ? 'bg-red-500/25 text-red-200' : 'bg-amber-400/20 text-amber-200'}`}>
                {etatDeSante(a)!.grave ? '✚ ' : '⚠ '}{dans(etatDeSante(a)!.titre)}
              </button>
            )}
            <button onClick={() => aller('gare')} className="mt-1.5 w-full flex items-center justify-between gap-2 text-[10px] font-bold text-left">
              <span className="truncate text-white/80"><Trophy size={10} className="inline -mt-0.5" /> {mot(comp.cle)}</span>
              <span className="shrink-0 tracking-widest" style={{ color: leJour ? VERT : undefined }}>
                {leJour ? dans(['AUJOURD’HUI', 'TODAY']) : cetteSemaine && !direct ? mot('ce_dimanche') : direct ? quand(direct) : mot('dans', { n: a.prochaine - a.semaine })}
              </span>
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <button onClick={onFermer} aria-label={mot('fermer')} className="w-10 h-10 rounded-xl bg-[rgba(8,18,14,0.86)] text-white/80 flex items-center justify-center"><X size={18} /></button>
            <button onClick={() => { setLieu(null); setTel('accueil'); }} aria-label={dans(['Téléphone', 'Phone'])} className="relative w-10 h-10 rounded-xl bg-[rgba(8,18,14,0.86)] text-white/80 flex items-center justify-center">
              <Smartphone size={18} />
              {nonLus(a) > 0 && <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">{nonLus(a)}</span>}
            </button>
            <button onClick={() => { setLieu(null); setTel('carte'); }} aria-label={dans(['Carte', 'Map'])} className="w-10 h-10 rounded-xl bg-[rgba(8,18,14,0.86)] text-white/80 flex items-center justify-center"><MapPin size={18} /></button>
            <button onClick={() => ville.current?.tourner(-1)} aria-label={dans(['Tourner', 'Rotate'])} className="w-10 h-10 rounded-xl bg-[rgba(8,18,14,0.86)] text-white/80 flex items-center justify-center"><RotateCcw size={16} /></button>
            <button onClick={() => ville.current?.tourner(1)} aria-label={dans(['Tourner', 'Rotate'])} className="w-10 h-10 rounded-xl bg-[rgba(8,18,14,0.86)] text-white/80 flex items-center justify-center"><RotateCw size={16} /></button>
          </div>
        </div>
      </div>

      {/* les besoins, comme les jauges d'un Sim */}
      {!lieu && !tel && (
        <div className="absolute left-[max(env(safe-area-inset-left),0.5rem)] bottom-[max(env(safe-area-inset-bottom),0.5rem)] w-44 rounded-2xl bg-[rgba(8,18,14,0.86)] backdrop-blur p-2 flex flex-col gap-1 shadow-xl">
          {BESOINS.map(k => {
            const v = besoinsDe(a)[k], I = ICONES_BESOINS[k];
            return (
              <div key={k} className="flex items-center gap-1.5">
                <I size={11} className="shrink-0 text-white/70" />
                <span className="text-[9px] font-bold tracking-wider text-white/70 w-14 truncate">{dans(NOMS_BESOINS[k])}</span>
                <span className="flex-1"><Jauge v={v} couleur={v < 25 ? '#FF5A5F' : v < 50 ? '#F5A623' : VERT} /></span>
              </div>
            );
          })}
        </div>
      )}

      {/* le telephone : messages, agenda, carriere, classement, banque, contacts, carte */}
      {tel && (
        <Telephone a={a} ville={ville.current} depart={tel} nom={l => nomLieu(l, a)} changer={changer}
                   onFermer={() => { sauver(a); setTel(null); }} aller={aller} />
      )}

      {/* le lieu ou l'on vient d'entrer */}
      {lieu && (
        <Feuille titre={nomLieu(lieu, a).toUpperCase()} sous={LIEUX[lieu].vrai} onFermer={() => { sauver(a); setLieu(null); }}>
          <Ici a={a} lieu={lieu} parler={p => { setLieu(null); setPersonne(p); }} />
          <DansLeLieu lieu={lieu} a={a} ev={!!ev} leJour={leJour} changer={changer} aller={aller}
                      surSeance={j => setSeance(j)} onEffacer={onEffacer}
                      surApparence={ap => changer(() => { a.apparence = ap; ville.current?.habiller(lookDe(ap, true)); })} />
        </Feuille>
      )}

      {personne && (
        <Feuille titre={dans(GENS[personne].nom(a)).toUpperCase()} sous={dans(roleDe(a, personne))} onFermer={() => { sauver(a); setPersonne(null); }}>
          <FicheDePersonne a={a} p={personne} ev={!!ev} changer={changer} />
        </Feuille>
      )}

      {ev && <Dialogue a={a} onRepondu={() => { sauver(a); maj(); }} />}
      {seance && <SeanceJeu jour={seance} a={a} onFin={() => { setSeance(null); sauver(a); maj(); }} />}
    </div>,
    document.body,
  );
}

/** Ton corps : l'usure de chaque zone (regles.ts, « le corps »), la charge des sept jours. */
function Corps({ a }: { a: Athlete }) {
  const u = usureDe(a);
  return (
    <Carte titre={dans(['TON CORPS', 'YOUR BODY'])}>
      {ZONES.map(z => {
        const v = Math.round(u[z]), c = v >= SEUIL_BLESSURE - 10 ? '#FF5A5F' : v >= SEUIL_GENE ? '#F5A623' : VERT;
        return (
          <div key={z} className="flex flex-col gap-0.5">
            <span className="flex justify-between text-[10px] font-bold text-white/70"><span>{dans(NOMS_ZONES[z])}</span><span className="tabular-nums">{v} / {SEUIL_BLESSURE}</span></span>
            <Jauge v={v} max={SEUIL_BLESSURE} couleur={c} />
          </div>
        );
      })}
      <p className="text-[10px] text-white/50">{dans(['Séances sur 7 jours', 'Sessions in 7 days'])} : {chargeDe(a)} · {dans(['Fatigue', 'Fatigue'])} {Math.round(a.fatigue)}</p>
    </Carte>
  );
}

/** L'Espace sante : le medecin du sport, l'imagerie a Louviers, le kine, l'osteopathe (sante.ts). */
function EspaceSante({ a, ev, changer }: { a: Athlete; ev: boolean; changer: (f: () => void) => void }) {
  const [bulle, setBulle] = useState<[string, string] | null>(null);
  const etat = etatDeSante(a);
  const ex = a.diagnostic && a.blessureType ? EXAMEN[a.blessureType] : null;
  const soin = (s: Soin, titre: [string, string], quoi: [string, string], duree: string) => {
    const refus = soinPossible(a, s), prix = resteACharge(a, s);
    return (
      <div className="flex items-center gap-2">
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-xs font-black">{dans(titre)}</span>
          <span className="text-[10px] text-white/55">{dans(quoi)} · {duree} · {prix ? `${prix} €` : dans(['pris en charge', 'covered'])}</span>
          {refus && <span className="text-[10px] text-amber-300/80">{dans(refus)}</span>}
        </span>
        <Bouton plein disabled={!!refus || ev} onClick={() => changer(() => { const r = soigner(a, s); setBulle('texte' in r ? r.texte : r.refus); })}>{dans(['OK', 'GO'])}</Bouton>
      </div>
    );
  };
  const kineRefus = a.kine ? 'fait' : a.argent < prixDuKine(a) ? 'argent' : null;
  return (
    <>
      {etat ? (
        <div className={`rounded-2xl p-3 ${etat.grave ? 'bg-red-500/15 border border-red-400/40' : 'bg-amber-400/10 border border-amber-300/30'}`}>
          <p className="text-sm font-black">{dans(etat.titre)}</p>
          {etat.detail && <p className="text-[11px] text-white/70">{dans(etat.detail)}</p>}
        </div>
      ) : <p className="text-xs text-white/70">{dans(['Tout va bien. Un suivi régulier évite les blessures.', 'All good. Regular check-ups prevent injuries.'])}</p>}
      {bulle && <div className="rounded-2xl bg-white text-[#10251C] px-3 py-2 text-sm font-semibold leading-snug">{dans(bulle)}</div>}
      <Corps a={a} />
      <Carte titre={dans(['SOIGNANTS', 'CARE'])}>
        {soin('medecin', ['Médecin du sport', 'Sports doctor'], ['Diagnostic, examens, certificat médical', 'Diagnosis, scans, medical certificate'], '40 min')}
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-xs font-black">{dans(['Kiné', 'Physio'])}</span>
            <span className="text-[10px] text-white/55">{dans(['Massage, rééducation : fatigue −25, une semaine d’arrêt de moins', 'Massage, rehab: fatigue −25, one week less out'])} · 45 min · {prixDuKine(a)} €{a.club ? dans([' (moitié club)', ' (club pays half)']) : ''}</span>
            {kineRefus && <span className="text-[10px] text-amber-300/80">{kineRefus === 'fait' ? dans(['Déjà vu cette semaine', 'Already seen this week']) : dans(['Pas assez d’argent', 'Not enough money'])}</span>}
          </span>
          <Bouton plein disabled={!!kineRefus || ev} onClick={() => changer(() => { if (!chezLeKine(a)) avancer(a, 45, { plaisir: 4 }); setBulle(['« On relâche tout ça. Étire-toi ce soir. »', '“Let’s loosen all that. Stretch tonight.”']); })}>{dans(['OK', 'GO'])}</Bouton>
        </div>
        {soin('osteo', ['Ostéopathe', 'Osteopath'], ['Soulage une gêne et la fatigue, non remboursé', 'Eases a niggle and fatigue, not reimbursed'], '50 min')}
      </Carte>
      {ex && (
        <Carte titre={dans(['IMAGERIE · CLINIQUE DE LOUVIERS', 'IMAGING · LOUVIERS CLINIC'])}>
          {ex === 'irm'
            ? soin('irm', ['IRM', 'MRI'], ['Le grade de la lésion, la vraie durée d’arrêt', 'The injury grade, the real time out'], dans(['3 h avec le bus', '3 h by bus']))
            : soin('radio', ['Radiographie', 'X-ray'], ['Écarter une fracture', 'Rule out a fracture'], dans(['3 h avec le bus', '3 h by bus']))}
        </Carte>
      )}
    </>
  );
}

/** Qui est la, dans ce lieu, en ce moment. */
function Ici({ a, lieu, parler }: { a: Athlete; lieu: Lieu; parler: (p: Personne) => void }) {
  const la = PERSONNES.filter(p => ouEst(a, p) === lieu);
  if (!la.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5 items-center">
      <span className="text-[10px] font-black tracking-widest text-white/50">{dans(['ICI', 'HERE'])}</span>
      {la.map(p => (
        <button key={p} onClick={() => parler(p)} className="rounded-full bg-white/90 text-[#0F2A1E] px-2.5 py-1 text-[11px] font-black">
          {dans(GENS[p].nom(a))} · {dans(['parler', 'talk'])}
        </button>
      ))}
    </div>
  );
}

/** La jauge d'une relation, de -100 a 100, avec son mot. */
function Lien({ v }: { v: number }) {
  const c = v < -15 ? '#FF5A5F' : v < 15 ? '#B9C2C9' : v < 50 ? '#7BD88F' : VERT;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="relative h-2 rounded-full bg-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-1/2 w-px bg-white/30" />
        <div className="absolute inset-y-0 rounded-full" style={{ left: `${Math.min(50, 50 + v / 2)}%`, width: `${Math.abs(v) / 2}%`, background: c }} />
      </div>
      <span className="text-[10px] font-bold" style={{ color: c }}>{dans(etiquette(v))} · {v > 0 ? '+' : ''}{v}</span>
    </div>
  );
}

/** La fiche d'une personne : la relation, ce qu'elle dit, ce qu'on peut faire avec elle. */
function FicheDePersonne({ a, p, ev, changer }: { a: Athlete; p: Personne; ev: boolean; changer: (f: () => void) => void }) {
  const [bulle, setBulle] = useState<[string, string] | null>(null);
  return (
    <>
      <Lien v={lienDe(a, p)} />
      {bulle && (
        <div className="relative rounded-2xl bg-white text-[#10251C] px-3 py-2 text-sm font-semibold leading-snug shadow-lg">
          {dans(bulle)}
          <span className="absolute -top-1.5 left-6 w-3 h-3 rotate-45 bg-white" />
        </div>
      )}
      <Carte titre={dans(['INTERAGIR', 'INTERACT'])} icone={MessageCircle}>
        {interactionsAvec(p).map(i => {
          const refus = i.possible?.(a, p);
          return (
            <button key={i.id} disabled={!!refus || ev}
                    onClick={() => changer(() => { const r = interagir(a, p, i.id); setBulle(r.replique || r.refus || null); })}
                    className="flex items-center justify-between gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-left disabled:opacity-40 hover:enabled:bg-white/10">
              <span className="flex flex-col">
                <span className="text-xs font-black">{dans(i.texte)}</span>
                {refus && <span className="text-[10px] text-amber-300/80">{dans(refus)}</span>}
              </span>
              <span className="text-[10px] text-white/50 shrink-0">{i.duree} min</span>
            </button>
          );
        })}
      </Carte>
    </>
  );
}

/** Tes proches : les relations, et ou chacun se trouve en ce moment. */
function Proches({ a }: { a: Athlete }) {
  return (
    <Carte titre={dans(['TES PROCHES', 'YOUR PEOPLE'])} icone={Users}>
      {PERSONNES.filter(p => (p !== 'coach' && p !== 'partenaire') || a.club).map(p => {
        const l = ouEst(a, p);
        return (
          <div key={p} className="flex flex-col gap-0.5">
            <span className="flex justify-between gap-2 text-xs">
              <b>{dans(GENS[p].nom(a))}</b>
              <span className="text-[10px] text-white/50">{l ? nomLieu(l as Lieu) : dans(['ailleurs', 'elsewhere'])}</span>
            </span>
            <Lien v={lienDe(a, p)} />
          </div>
        );
      })}
    </Carte>
  );
}

/** Une feuille qui monte du bas de l'ecran. */
function Feuille({ titre, sous, onFermer, children }: { titre: string; sous?: string; onFermer: () => void; children: React.ReactNode }) {
  return (
    <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-[max(env(safe-area-inset-left),0.5rem)] pr-[max(env(safe-area-inset-right),0.5rem)] pb-[max(env(safe-area-inset-bottom),0.5rem)]">
      <motion.div {...PANNEAU} className="w-full max-w-lg max-h-[68vh] overflow-y-auto rounded-2xl border p-3 flex flex-col gap-2 shadow-2xl"
                  style={{ borderColor: `${VERT}66`, background: 'linear-gradient(160deg, #10251CF5, #0A1410F7)' }}>
        <div className="flex items-start justify-between gap-2 sticky -top-3 -mx-3 px-3 pt-3 pb-1 -mt-3 z-10 rounded-t-2xl bg-[#10251C]">
          <div className="min-w-0">
            <h3 className="font-black font-display text-xl tracking-wide" style={{ color: VERT }}>{titre}</h3>
            {sous && <p className="text-[10px] font-bold tracking-widest text-white/50">{sous}</p>}
          </div>
          <button onClick={onFermer} aria-label={mot('fermer')} className="p-1.5 text-white/70 hover:text-white"><X size={18} /></button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

/** Ce qu'on fait dans chaque lieu. */
function DansLeLieu({ lieu, a, ev, leJour, changer, aller, surSeance, onEffacer, surApparence }: {
  lieu: Lieu; a: Athlete; ev: boolean; leJour: boolean;
  changer: (f: () => void) => void; aller: (l: Lieu) => void; surSeance: (j: Jour) => void;
  onEffacer: () => void; surApparence: (ap: Apparence) => void;
}) {
  const [efface, setEfface] = useState(false);
  const [miroir, setMiroir] = useState(false);
  const [epreuve, setEpreuve] = useState<Epreuve>(a.specialite || '100');
  const club = lieuDuClub(a);
  // les seances de la semaine qui se font ICI
  const seancesIci = JOURS.filter(j => {
    const l = lieuDeLExercice(a, exerciceDuJour(a, j));
    return l === lieu || (lieu === club && (l === 'club_quartier' || l === 'club_horizon'));
  });
  const ailleurs = JOURS.filter(j => !seancesIci.includes(j));

  const Seances = () => (
    <Carte titre={dans(['S’ENTRAÎNER ICI', 'TRAIN HERE'])} icone={Flag}>
      {a.gene && a.blessure === 0 && (
        <p className="text-[11px] text-amber-300/90">⚠ {dans(BLESSURES[a.gene].gene)} {dans(NOMS_ZONES[a.gene as Zone])} : {Math.round(usureDe(a)[a.gene as Zone])} / {SEUIL_BLESSURE}. {dans(['Une séance qui les sollicite peut casser. Le kiné, l’ostéo et le sommeil font redescendre.', 'A session that loads them may break them. Physio, osteo and sleep bring it down.'])}</p>
      )}
      {seancesIci.map(j => {
        const raison = seancePossible(a, j), quand_ = seanceMaintenant(a, j);
        return (
          <div key={j} className="flex items-center gap-2">
            <span className="w-1 self-stretch rounded-full" style={{ background: COULEUR[SEANCES[j].stat] }} />
            <span className="flex-1 min-w-0 flex flex-col">
              <span className="text-[10px] font-black tracking-widest text-white/70">{mot(j)} · {dans(EXOS[exerciceDuJour(a, j)].nom).toUpperCase()}</span>
              <span className="text-xs text-white/80 truncate">{seanceDuJour(a, j)}</span>
              {!raison && quand_ && <span className="text-[10px] text-amber-300/80">{dans(RAISONS[quand_])}</span>}
            </span>
            {raison
              ? <span className="text-[10px] font-black tracking-widest text-white/40">{raison === 'faite' ? mot('faite') : raison === 'blesse' ? mot('blesse') : mot('pris')}</span>
              : <Bouton plein disabled={ev || !!quand_} onClick={() => surSeance(j)}>{mot('sentrainer')}</Bouton>}
          </div>
        );
      })}
    </Carte>
  );

  const Programme = () => (
    <Carte titre={dans(['LE PROGRAMME DE LA SEMAINE', 'THIS WEEK’S PLAN'])} icone={Flag}>
      {!a.coach && <p className="text-[11px] text-white/50">{mot('seul')}</p>}
      {JOURS.map(j => {
        const l = lieuDeLExercice(a, exerciceDuJour(a, j)) as Lieu;
        const fait = a.faites.includes(j);
        return (
          <button key={j} disabled={fait} onClick={() => aller(l)} className="flex items-center gap-2 text-left disabled:opacity-40">
            <span className="w-1 self-stretch rounded-full" style={{ background: COULEUR[SEANCES[j].stat] }} />
            <span className="flex-1 min-w-0 text-xs"><b>{mot(j)}</b> · {dans(EXOS[exerciceDuJour(a, j)].nom)}</span>
            <span className="text-[10px] font-black tracking-widest" style={{ color: fait ? undefined : VERT }}>{fait ? mot('faite') : `${nomLieu(l)} ›`}</span>
          </button>
        );
      })}
    </Carte>
  );

  switch (lieu) {
    case 'maison': return (
      <>
        <p className="text-xs text-white/70">{etape(a) === 'adulte'
          ? dans([`Ton appartement. Le loyer (${LOYER} €) tombe le dimanche soir, quand la semaine tourne.`, `Your flat. Rent (€${LOYER}) is due on Sunday night, when the week turns.`])
          : dans(['Ta chambre, ton lit, le frigo des parents. Dormir le dimanche soir fait tourner la semaine.', 'Your room, your bed, your parents’ fridge. Sleeping on Sunday night turns the week.'])}</p>
        {leJour && <p className="text-[11px] text-amber-300/80">{dans(['Aujourd’hui, c’est la compétition : passe à la gare avant de te coucher.', 'Today is race day: go to the station before bed.'])}</p>}
        <Actions a={a} lieu="maison" ev={ev} changer={changer} />
        <Programme />
        <Proches a={a} />
        <Carte><Barres a={a} /></Carte>
        <Bouton onClick={() => setMiroir(m => !m)}>{dans(['LE MIROIR · CHANGER DE STYLE', 'THE MIRROR · CHANGE STYLE'])}</Bouton>
        {miroir && <ChoixApparence ap={apparenceDe(a)} onChange={surApparence} />}
        {a.palmares.length > 0 && (
          <Carte titre={mot('palmares')} icone={Trophy}>
            {a.palmares.slice(0, 6).map((p, i) => (
              <p key={i} className="text-xs text-white/75 flex justify-between gap-2">
                <span className="truncate">{mot(COMPETITIONS[p.niveau].cle)} · {p.epreuve} m</span>
                <span className="tabular-nums shrink-0">{p.chrono === null ? mot('faux') : `${mot('place', { o: ordPlace(p.place) })} · ${p.chrono.toFixed(2)}`}</span>
              </p>
            ))}
          </Carte>
        )}
        {a.journal.length > 0 && (
          <Carte titre={mot('journal')} icone={BookOpen}>
            {a.journal.slice(0, 8).map((l, i) => (
              <p key={i} className="text-[11px] text-white/60 leading-snug"><span className="text-white/35 tabular-nums">S{l.s} · </span>{dans([l.fr, l.en])}</p>
            ))}
          </Carte>
        )}
        <div className="flex items-center justify-center gap-2 pt-1 text-[11px] text-white/45">
          {!efface ? <button onClick={() => setEfface(true)} className="underline">{mot('recommencer')}</button> : <>
            <span>{mot('sur')}</span>
            <button onClick={onEffacer} className="font-black text-red-400">{mot('oui')}</button>
            <button onClick={() => setEfface(false)} className="font-black text-white/70">{mot('non')}</button>
          </>}
        </div>
      </>
    );

    case 'gare': {
      const comp = COMPETITIONS[a.niveau];
      const cout = coutDuDeplacement(a, a.niveau), payable = a.argent >= cout;
      return (
        <Carte titre={mot('competition')} icone={Trophy}>
          <span className="font-black text-sm">{mot(comp.cle)}</span>
          {leJour && certificatRequis(a) && <p className="text-[11px] text-amber-300/90">{dans(['Pas de certificat médical pour cette saison : passe d’abord par le médecin du sport (Espace santé).', 'No medical certificate this season: see the sports doctor first (Health centre).'])}</p>}
          {leJour && <Actions a={a} lieu="gare" ev={ev} changer={changer} />}
          {leJour && <p className="text-[11px] text-white/50">{a.echauffe ? dans(['Échauffé·e : les ischios sont prêts.', 'Warmed up: your hamstrings are ready.']) : dans(['Sans échauffement, le risque de claquage monte.', 'Without a warm-up, the risk of a strain goes up.'])}</p>}
          {!leJour ? <p className="text-xs text-white/60">{jourDe(a) !== DIMANCHE && jourDeLAthlete(a).cetteSemaine
            ? dans(['C’est ce dimanche. Reviens le jour J, le train part le matin.', 'It’s this Sunday. Come back on the day, the train leaves in the morning.'])
            : dans(['Le train attendra : ta prochaine compétition n’est pas pour ce dimanche.', 'The train can wait: your next meet isn’t this Sunday.'])}</p> : <>
            <p className="text-[11px] text-white/60">
              {cout === 0 ? mot('paye') : mot('deplacement', { n: cout })}
              {!payable && <span className="text-red-400"> · {mot('pas_moyens')}</span>}
            </p>
            {!a.specialite && <div className="flex gap-2">{EPREUVES.map(e => <Bouton key={e} plein={epreuve === e} onClick={() => setEpreuve(e)} className="flex-1">{e} m</Bouton>)}</div>}
            <div className="flex gap-2">
              <Bouton plein className="flex-1 py-3 text-sm" disabled={!payable || a.blessure > 0 || ev || certificatRequis(a)}
                      onClick={() => { if (partirALaCompetition(a, a.specialite || epreuve)) demanderReouverture(); }}>
                {mot('courir')} · {a.specialite || epreuve} m
              </Bouton>
              <Bouton disabled={ev} onClick={() => changer(() => forfait(a))}>{mot('forfait')}</Bouton>
            </div>
          </>}
        </Carte>
      );
    }

    case 'kine': return <EspaceSante a={a} ev={ev} changer={changer} />;

    case 'parc': case 'piscine': return (
      <>
        {lieu === 'parc' && seancesIci.length > 0 && <Seances />}
        {lieu === 'parc' && <Actions a={a} lieu="parc" ev={ev} changer={changer} />}
        <p className="text-xs text-white/70">{lieu === 'parc'
          ? dans(['Un footing léger autour du lac : le corps récupère, la tête aussi.', 'An easy jog round the lake: the body recovers, and the mind.'])
          : dans(['Quelques longueurs souples à la piscine Alice Milliat : la récupération active des sprinteurs.', 'A few easy lengths at the Alice Milliat pool: the sprinter’s active recovery.'])}</p>
        <Bouton plein className="py-3" disabled={!!a.footing || a.blessure > 0 || ev} onClick={() => changer(() => { if (footingAuParc(a)) avancer(a, 45, { hygiene: -25, energie: -4, plaisir: 8 }); })}>
          {a.footing ? dans(['DÉJÀ FAIT CETTE SEMAINE', 'ALREADY DONE THIS WEEK']) : lieu === 'parc' ? dans(['FOOTING DE RÉCUPÉRATION', 'RECOVERY JOG']) : dans(['NAGER POUR RÉCUPÉRER', 'SWIM TO RECOVER'])}
        </Bouton>
      </>
    );

    case 'boutique': return (
      <Carte titre={mot('boutique')} icone={ShoppingBag}>
        {/* le velo : traverser Val-de-Reuil en quelques minutes, sans ticket (telephone.ts, trajet) */}
        <div className="flex items-center gap-2">
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-xs font-black">{dans(['Vélo de ville', 'City bike'])}</span>
            <span className="text-[10px] text-white/55">{dans(['Les trajets 3 fois plus vite qu’à pied, gratuits', 'Trips 3× faster than walking, free'])}</span>
          </span>
          {a.velo
            ? <span className="text-[10px] font-black tracking-widest" style={{ color: VERT }}>{mot('possede')}</span>
            : <Bouton disabled={a.argent < PRIX_VELO} onClick={() => changer(() => { payer(a, -PRIX_VELO, 'Vélo', 'Bike'); a.velo = true; })}>{PRIX_VELO} €</Bouton>}
        </div>
        {MATERIEL.map(p => {
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
    );

    case 'marche': case 'livraison': case 'babysitting': {
      const b = BOULOTS.find(x => x.id === BOULOT_DU_LIEU[lieu])!;
      const pris = !!a.boulot;
      return (
        <>
        <Actions a={a} lieu={lieu} ev={ev} changer={changer} />
        <Carte titre={mot('boulots')} icone={Briefcase}>
          <span className="text-sm font-black">{mot(b.id)}</span>
          <span className="text-[11px] text-white/60">{Math.round(DUREE_BOULOT[b.id] / 60)} h · +{b.gain} € · {mot('fatigue').toLowerCase()} +{b.fatigue}{b.prend ? ` · ${mot('prend_samedi')}` : ''}</span>
          <Bouton plein disabled={pris || ev || (!!b.prend && a.faites.includes(b.prend))} onClick={() => changer(() => { if (prendreUnBoulot(a, b.id)) avancer(a, DUREE_BOULOT[b.id] || 120, { energie: -8 }); })}>
            {pris ? mot('boulot_pris') : dans(['TRAVAILLER', 'WORK'])}
          </Bouton>
        </Carte>
        </>
      );
    }

    case 'club_quartier': case 'club_horizon': {
      const membre = club === lieu;
      return (
        <>
          {membre && seancesIci.length > 0 && <Seances />}
          {membre && <Actions a={a} lieu="club" ev={ev} changer={changer} />}
          <Carte titre={mot('club')} icone={Users}>
            {membre ? (
              <>
                <p className="text-xs flex items-center gap-2">
                  {a.club === 'quartier' && logoDuClub() && <img src={logoDuClub()!} alt="" className="h-8 w-auto" />}
                  {nomDuClub(a.club!, mot(a.club!))} · {mot(a.coach || '')}
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {(['coach', 'club', 'rival'] as const).map(k => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-[10px] font-bold text-white/60">{mot(`rel_${k}`)} {a.relations[k] > 0 ? '+' : ''}{a.relations[k]}</span>
                      <Jauge v={a.relations[k] + 100} max={200} couleur={a.relations[k] >= 0 ? VERT : '#FF5A5F'} />
                    </div>
                  ))}
                </div>
              </>
            ) : <p className="text-xs text-white/60">{a.club ? dans(['Ce n’est pas ton club. On te regarde passer.', 'Not your club. They watch you go by.']) : dans(['Pas encore de licence ici. Les entraîneurs viendront peut-être te voir après une course.', 'No licence here yet. The coaches may come and find you after a race.'])}</p>}
            <p className="flex flex-wrap gap-x-3 text-[11px] text-white/60">
              <span className="flex items-center gap-1"><Star size={11} /> {mot('reputation', { n: a.reputation })}</span>
              <span className="flex items-center gap-1"><Smartphone size={11} /> {mot('abonnes', { n: a.abonnes })}</span>
              {a.sponsors.length > 0 && <span>{mot('sponsors', { n: a.sponsors.length })}</span>}
            </p>
          </Carte>
        </>
      );
    }

    case 'stade': case 'cote': return (
      <>
        <p className="text-xs text-white/70">{lieu === 'stade'
          ? dans(['La piste rouge de huit couloirs, la halle couverte pour l’hiver. C’est ici qu’on devient sprinteur.', 'The red eight-lane track, the indoor hall for winter. This is where you become a sprinter.'])
          : dans(['Une rue qui monte dur. Les côtes, c’est la force des jambes — et du mental.', 'A street that climbs hard. Hills build leg power — and mind.'])}</p>
        {seancesIci.length ? <Seances /> : <p className="text-[11px] text-white/50">{dans(['Rien de prévu ici cette semaine.', 'Nothing planned here this week.'])}</p>}
        {ailleurs.length > 0 && <Programme />}
      </>
    );

    case 'college': return (
      <>
        <p className="text-xs text-white/70">{etape(a) === 'college' ? dans(['Les cours, les copains, le prof d’EPS qui t’a repéré. Il te suit de loin.', 'Classes, friends, the PE teacher who spotted you. He keeps an eye on you.']) : dans(['Ton ancien collège. Les souvenirs du cross de sixième.', 'Your old secondary school. Memories of the year-7 cross-country.'])}</p>
        <Actions a={a} lieu="college" ev={ev} changer={changer} />
        {etape(a) === 'college' && <p className="text-[11px] text-white/60">{dans(['Bulletin', 'Report card'])} · {Math.round(a.ecole ?? 60)} / 100</p>}
        {a.objectif && <p className="text-[11px] text-white/60">{mot('objectif', { o: mot(COMPETITIONS[NIVEAU_OBJECTIF[a.objectif]].cle) })} · {mot('assiduite', { f: a.assiduite.faites, p: a.assiduite.proposees })}</p>}
        <Carte><Barres a={a} /></Carte>
      </>
    );

    case 'lycee': return (
      <>
        <p className="text-xs text-white/70">{etape(a) === 'lycee'
          ? dans(['Ton lycée. Les horaires aménagés pour les sportifs, ça se demande à Mme Sarr.', 'Your high school. Adjusted timetables for athletes can be asked of Ms Sarr.'])
          : etape(a) === 'college' ? dans(['Le lycée Marc Bloch t’attend en seconde.', 'Marc Bloch high school awaits you in year 10.']) : dans(['Ton ancien lycée.', 'Your old high school.'])}</p>
        <Actions a={a} lieu="lycee" ev={ev} changer={changer} />
        {etape(a) === 'lycee' && <p className="text-[11px] text-white/60">{dans(['Bulletin', 'Report card'])} · {Math.round(a.ecole ?? 60)} / 100</p>}
      </>
    );

    case 'travail': return (
      <>
        <p className="text-xs text-white/70">{etape(a) === 'adulte'
          ? dans(['La zone d’activité des Lacs : ton boulot de la semaine, de 9 h à 17 h. Il paie le loyer ; il te laisse les soirs pour t’entraîner.', 'The Les Lacs business park: your weekday job, 9 am to 5 pm. It pays the rent and leaves your evenings for training.'])
          : dans(['Des entrepôts, des bureaux. Pas encore pour toi.', 'Warehouses, offices. Not for you yet.'])}</p>
        <Actions a={a} lieu="travail" ev={ev} changer={changer} />
      </>
    );

    case 'parents': return (
      <>
        <p className="text-xs text-white/70">{dans(['La maison de ton enfance. Il y a toujours une assiette pour toi.', 'Your childhood home. There’s always a plate for you.'])}</p>
        <Actions a={a} lieu="parents" ev={ev} changer={changer} />
      </>
    );

    case 'mairie': return (
      <>
        <p className="text-xs text-white/70">{dans(['La ville suit ses sportifs. Un bon palmarès et on parle de toi aux trophées des sports.', 'The town follows its athletes. A good record and you’ll be named at the sports awards.'])}</p>
        <p className="flex flex-wrap gap-x-3 text-[11px] text-white/60"><span className="flex items-center gap-1"><Star size={11} /> {mot('reputation', { n: a.reputation })}</span></p>
      </>
    );
  }
  return null;
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
  // qualifie : le tour suivant, l'apres-midi ou le soir, sans repayer le deplacement
  const tourSuivant = () => { const a = athlete(); if (a && r?.suivant && r.suivant !== 'serie') partirALaCompetition(a, r.epreuve, r.suivant); };
  const NOM_DU_TOUR: Record<string, [string, string]> = { serie: ['SÉRIE', 'HEAT'], demie: ['DEMI-FINALE', 'SEMI-FINAL'], finale: ['FINALE', 'FINAL'] };
  const vers: [string, string] = r?.suivant === 'demie' ? ['LA DEMI-FINALE', 'THE SEMI-FINAL'] : ['LA FINALE', 'THE FINAL'];

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto flex items-center justify-center
                    bg-[rgba(4,10,8,0.9)] px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} className="w-full max-w-md flex flex-col items-center gap-3 text-center">
        {r && (
          <>
            <span className="text-[10px] font-bold tracking-[0.28em]" style={{ color: VERT }}>
              {mot(COMPETITIONS[r.niveau].cle).toUpperCase()} · {r.epreuve} M
            </span>
            {r.tour && <span className="text-[10px] font-black tracking-[0.3em] text-white/60">{dans(NOM_DU_TOUR[r.tour])}</span>}
            <span className={`font-black font-display text-3xl sm:text-4xl uppercase tracking-tight leading-[0.95]
                              ${r.chrono !== null && (r.place <= 3 || r.suivant) ? 'text-white' : 'text-destructive'}`}>
              {r.suivant ? `${dans(['QUALIFIÉ·E', 'THROUGH'])}${r.auTemps ? dans([' AU TEMPS', ' ON TIME']) : ''} ${dans(['POUR', 'TO'])} ${dans(vers)}`
                : r.sommet ? mot('sommet') : r.chrono === null ? mot('faux')
                : r.tour === 'serie' ? dans(['ÉLIMINÉ·E EN SÉRIE', 'OUT IN THE HEATS']) : r.tour === 'demie' ? dans(['ÉLIMINÉ·E EN DEMI-FINALE', 'OUT IN THE SEMI-FINALS'])
                : mot('place', { o: ordPlace(r.place) })}
            </span>
            {r.chrono !== null && <span className="font-black tabular-nums text-xl">{r.chrono.toFixed(2)} s{r.suivant ? ` · ${ord(r.place)}` : ''}</span>}
            {r.vent != null && (
              <span className="text-xs" style={{ color: r.homologue ? undefined : '#F5A623' }}>
                {dans(['Vent', 'Wind'])} {r.vent > 0 ? '+' : ''}{r.vent.toFixed(1)} m/s{!r.homologue && dans([' · trop de vent : record non homologué', ' · wind too strong: not a legal record'])}
              </span>
            )}
            {r.record && <span className="text-sm font-black" style={{ color: VERT }}>{dans(['RECORD PERSONNEL !', 'PERSONAL BEST!'])}</span>}
            {r.blessure && <span className="text-sm font-bold text-red-400">{dans(BLESSURES[r.blessure].nom)} · {dans(['va voir le médecin du sport', 'see the sports doctor'])}</span>}
            {!r.suivant && (
              <span className="text-sm" style={{ color: suivant ? VERT : undefined }}>
                {suivant ? mot('qualifie', { c: mot(suivant.cle) }) : !r.sommet ? mot('pas_qualifie', { n: ecart(r.niveau) }) : null}
              </span>
            )}
            <span className="text-xs text-white/60">
              {r.prime > 0 && `${mot('prime', { n: r.prime })} · `}{mot('rep_plus', { n: r.reputation })}
            </span>
          </>
        )}
        {r?.suivant && <Bouton plein className="px-8 py-3 mt-2" onClick={tourSuivant}>{dans(['COURIR', 'RUN'])} {dans(vers)}</Bouton>}
        <Bouton plein={!r?.suivant} className="px-8 py-3 mt-2" onClick={retour}>{r?.suivant ? dans(['Renoncer', 'Withdraw']) : mot('retour_carriere')}</Bouton>
      </motion.div>
    </div>
  );
}
