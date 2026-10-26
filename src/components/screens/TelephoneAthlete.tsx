import React, { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  MessageCircle, CalendarDays, Trophy, ListOrdered, Wallet, Users, Map as Carte, ChevronLeft,
  Footprints, Bike, Bus, Wifi, BatteryFull, Phone,
} from 'lucide-react';
import {
  type Athlete, type Epreuve, COMPETITIONS, EPREUVES, libelleEpreuve, etape, categorie, jourDe, heureDe,
} from '@/game/athlete/regles';
import { type Personne, GENS, PERSONNES, ouEst, lienDe, etiquette, interagir, roleDe } from '@/game/athlete/gens';
import { type Mode, type Auteur, toutLire, nonLus, classement, trajet, agenda } from '@/game/athlete/telephone';
import { mot, dans } from '@/game/athlete/mots';
import { nomDuClub } from '@/game/athlete/partenaires';
import { type Ville, type Lieu, type Donnees, LIEUX, chargerVille } from '@/game/athlete/ville';

/* ---------------------------------------------------------------------------
   LE TELEPHONE — le centre de commande de la carriere, comme dans Lagos Life
   (docs/carriere-athlete.md). Sept applis : Messages, Agenda, Carriere,
   Classement, Banque, Contacts, Carte (avec les trajets a pied, a velo, en
   bus). La logique est dans game/athlete/telephone.ts ; ici, l'ecran.
--------------------------------------------------------------------------- */

export type App = 'accueil' | 'messages' | 'agenda' | 'carriere' | 'classement' | 'banque' | 'contacts' | 'carte';

const VERT = '#3DDC84';
const JOURS: [string, string][] = [['Lundi', 'Monday'], ['Mardi', 'Tuesday'], ['Mercredi', 'Wednesday'], ['Jeudi', 'Thursday'], ['Vendredi', 'Friday'], ['Samedi', 'Saturday'], ['Dimanche', 'Sunday']];
const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

const APPS: { id: Exclude<App, 'accueil'>; nom: [string, string]; icone: typeof Phone; fond: string }[] = [
  { id: 'messages', nom: ['Messages', 'Messages'], icone: MessageCircle, fond: 'linear-gradient(160deg,#4ADE80,#16A34A)' },
  { id: 'agenda', nom: ['Agenda', 'Calendar'], icone: CalendarDays, fond: 'linear-gradient(160deg,#FB7185,#E11D48)' },
  { id: 'carriere', nom: ['Carrière', 'Career'], icone: Trophy, fond: 'linear-gradient(160deg,#FCD34D,#D97706)' },
  { id: 'classement', nom: ['Classement', 'Rankings'], icone: ListOrdered, fond: 'linear-gradient(160deg,#60A5FA,#2563EB)' },
  { id: 'banque', nom: ['Banque', 'Bank'], icone: Wallet, fond: 'linear-gradient(160deg,#2DD4BF,#0F766E)' },
  { id: 'contacts', nom: ['Contacts', 'Contacts'], icone: Users, fond: 'linear-gradient(160deg,#FDBA74,#EA580C)' },
  { id: 'carte', nom: ['Carte', 'Map'], icone: Carte, fond: 'linear-gradient(160deg,#C4B5FD,#7C3AED)' },
];

type Props = {
  a: Athlete;
  ville: Ville | null;
  depart?: App;
  /** Le lieu a montrer en ouvrant la carte. */
  vise?: Lieu | null;
  nom: (l: Lieu) => string;
  changer: (f: () => void) => void;
  onFermer: () => void;
  /** Partir vers un lieu : a pied (on marche), a velo ou en bus (on y est). */
  aller: (l: Lieu, mode: Mode) => void;
};

export function Telephone(p: Props) {
  const [app, setApp] = useState<App>(p.depart || 'accueil');
  const [vise, setVise] = useState<Lieu | null>(p.vise || null);
  const ouvrir = (x: App, l?: Lieu) => { if (l) setVise(l); setApp(x); };
  const titre = APPS.find(x => x.id === app);

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm select-none" onClick={p.onFermer}>
      <motion.div initial={{ y: 60, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 24, stiffness: 260 }}
                  onClick={e => e.stopPropagation()}
                  className="relative w-[min(92vw,390px)] h-[min(88vh,780px)] rounded-[2.6rem] border-[7px] border-[#0b0b0d] bg-[#0b0b0d] shadow-[0_30px_80px_rgba(0,0,0,.6)] overflow-hidden flex flex-col">
        {/* la barre d'etat : l'heure du jeu, le reseau, la batterie */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-2.5 pb-1 text-[12px] font-bold text-white">
          <span className="tabular-nums">{hm(heureDe(p.a))}</span>
          <span className="absolute left-1/2 -translate-x-1/2 top-1.5 w-24 h-6 rounded-full bg-black" />
          <span className="flex items-center gap-1.5"><Wifi size={13} /><BatteryFull size={16} /></span>
        </div>
        <div className="relative flex-1 min-h-0 flex flex-col" style={{ background: app === 'accueil' ? 'radial-gradient(120% 80% at 20% 0%,#1F6F4A 0%,#0E2A1E 55%,#071510 100%)' : '#0F1412' }}>
          {app === 'accueil' ? <Accueil a={p.a} ouvrir={ouvrir} /> : (
            <>
              <div className="flex items-center gap-1 px-2 py-2 border-b border-white/10">
                <button onClick={() => setApp('accueil')} className="p-1.5 text-white/80" aria-label={dans(['Retour', 'Back'])}><ChevronLeft size={20} /></button>
                <span className="font-black text-lg text-white">{titre && dans(titre.nom)}</span>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto">
                {app === 'messages' && <Messages a={p.a} />}
                {app === 'agenda' && <AgendaApp a={p.a} nom={p.nom} montrer={l => ouvrir('carte', l)} />}
                {app === 'carriere' && <CarriereApp a={p.a} />}
                {app === 'classement' && <ClassementApp a={p.a} />}
                {app === 'banque' && <Banque a={p.a} />}
                {app === 'contacts' && <Contacts a={p.a} nom={p.nom} changer={p.changer} />}
                {app === 'carte' && <CarteApp a={p.a} ville={p.ville} nom={p.nom} vise={vise} setVise={setVise} aller={p.aller} />}
              </div>
            </>
          )}
          {/* la barre du bas : revenir a l'accueil, ou ranger le telephone */}
          <button onClick={() => (app === 'accueil' ? p.onFermer() : setApp('accueil'))} aria-label={dans(['Accueil', 'Home'])}
                  className="shrink-0 h-6 flex items-center justify-center">
            <span className="w-32 h-1.5 rounded-full bg-white/70" />
          </button>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------------ l'accueil */

function Accueil({ a, ouvrir }: { a: Athlete; ouvrir: (x: App) => void }) {
  const n = nonLus(a);
  return (
    <div className="flex-1 flex flex-col px-5 pt-6">
      <div className="text-center text-white">
        <div className="text-[13px] font-semibold opacity-80">{dans(JOURS[jourDe(a)])} · {mot('semaine', { n: a.semaine })}</div>
        <div className="font-black text-6xl tabular-nums tracking-tight">{hm(heureDe(a))}</div>
      </div>
      <div className="grid grid-cols-4 gap-x-3 gap-y-5 mt-8">
        {APPS.map(x => {
          const I = x.icone;
          return (
            <button key={x.id} onClick={() => ouvrir(x.id)} className="flex flex-col items-center gap-1.5 active:scale-95 transition-transform">
              <span className="relative w-14 h-14 rounded-[1.1rem] flex items-center justify-center shadow-lg" style={{ background: x.fond }}>
                <I size={26} color="#fff" strokeWidth={2.2} />
                {x.id === 'messages' && n > 0 && <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-red-500 text-white text-[11px] font-black flex items-center justify-center">{n}</span>}
              </span>
              <span className="text-[11px] font-semibold text-white/90">{dans(x.nom)}</span>
            </button>
          );
        })}
      </div>
      {n > 0 && (
        <button onClick={() => ouvrir('messages')} className="mt-auto mb-4 rounded-2xl bg-white/15 backdrop-blur p-3 text-left">
          <span className="text-[11px] font-bold text-white/60">{dans(['MESSAGES', 'MESSAGES'])}</span>
          <span className="block text-sm text-white truncate">{dans([a.messages![0].fr, a.messages![0].en])}</span>
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ les applis */

const nomAuteur = (a: Athlete, de: string): string =>
  de === 'banque' ? dans(['Ta banque', 'Your bank']) : de === 'club' ? dans(['Le club', 'The club']) : dans(GENS[de as Personne].nom(a));

function Messages({ a }: { a: Athlete }) {
  // on garde ce qui etait nouveau a l'ouverture, puis tout est lu
  const nouveaux = useMemo(() => new Set((a.messages || []).map((m, i) => (!m.lu ? i : -1))), []);
  useEffect(() => { toutLire(a); }, []);
  const l = a.messages || [];
  if (!l.length) return <Vide t={['Pas encore de messages.', 'No messages yet.']} />;
  return (
    <div className="flex flex-col">
      {l.map((m, i) => (
        <div key={i} className="flex gap-3 px-4 py-3 border-b border-white/5">
          <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black text-white" style={{ background: couleurAuteur(m.de as Auteur) }}>
            {nomAuteur(a, m.de).replace(/^(Ta |Ton |M\. |Mme |Coach |Le |Your |Mr |Ms )/, '').charAt(0).toUpperCase()}
          </span>
          <span className="flex-1 min-w-0">
            <span className="flex justify-between gap-2">
              <span className={`text-sm truncate ${nouveaux.has(i) ? 'font-black text-white' : 'font-semibold text-white/85'}`}>{nomAuteur(a, m.de)}</span>
              <span className="text-[10px] text-white/45 shrink-0">{dans(JOURS[m.j]).slice(0, 3)}. {hm(m.h)}</span>
            </span>
            <span className={`block text-[13px] leading-snug ${nouveaux.has(i) ? 'text-white' : 'text-white/65'}`}>{dans([m.fr, m.en])}</span>
          </span>
          {nouveaux.has(i) && <span className="w-2 h-2 rounded-full bg-[#3DDC84] self-center" />}
        </div>
      ))}
    </div>
  );
}
const couleurAuteur = (d: Auteur) => ({ maman: '#E879F9', papa: '#60A5FA', prof: '#94A3B8', coach: '#F59E0B', amie: '#F472B6', rival: '#EF4444', partenaire: '#2DD4BF', club: '#22C55E', banque: '#0EA5E9' } as Record<string, string>)[d] || '#64748B';

function AgendaApp({ a, nom, montrer }: { a: Athlete; nom: (l: Lieu) => string; montrer: (l: Lieu) => void }) {
  const jours = agenda(a), auj = jourDe(a);
  return (
    <div className="flex flex-col gap-2 p-3">
      {jours.map((l, j) => (
        <div key={j} className={`rounded-2xl p-3 ${j === auj ? 'bg-[#3DDC84]/15 border border-[#3DDC84]/50' : 'bg-white/5'}`}>
          <div className="flex justify-between text-xs font-black text-white mb-1">
            <span>{dans(JOURS[j])}</span>{j === auj && <span style={{ color: VERT }}>{dans(['AUJOURD’HUI', 'TODAY'])}</span>}
          </div>
          {!l.length && <span className="text-[12px] text-white/40">{dans(['Repos', 'Rest'])}</span>}
          {l.map((r, i) => (
            <button key={i} onClick={() => montrer(r.ou as Lieu)} className="w-full flex items-center gap-2 py-1 text-left">
              <span className="text-[11px] tabular-nums text-white/55 w-20 shrink-0">{hm(r.quand[0])}–{hm(r.quand[1])}</span>
              <span className="flex-1 text-[13px] text-white truncate">{dans(r.quoi)}</span>
              <span className="text-[11px] font-bold shrink-0" style={{ color: VERT }}>{nom(r.ou as Lieu)} ›</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

function CarriereApp({ a }: { a: Athlete }) {
  const cat = categorie(a.age ?? 14), e = etape(a);
  const vie: [string, string] = e === 'college' ? ['Collégien', 'Secondary school'] : e === 'lycee' ? ['Lycéen', 'High school'] : ['Vie active', 'Working life'];
  return (
    <div className="flex flex-col gap-3 p-4 text-white">
      <div>
        <div className="font-black text-2xl" style={{ color: VERT }}>{a.nom}</div>
        <div className="text-[12px] text-white/70">{a.age ?? 14} {dans(['ans', 'yrs'])} · {dans(cat)} · {dans(vie)}{a.club ? ` · ${nomDuClub(a.club, mot(a.club))}` : ''}</div>
      </div>
      <Bloc t={['NIVEAU', 'LEVEL']}>
        <div className="text-sm font-black">{mot(COMPETITIONS[a.niveau].cle)}</div>
        <div className="text-[12px] text-white/60">{dans(['Un podium fait monter d’un niveau.', 'A podium moves you up a level.'])} {a.niveau < COMPETITIONS.length - 1 && `${dans(['Ensuite :', 'Next:'])} ${mot(COMPETITIONS[a.niveau + 1].cle)}`}</div>
      </Bloc>
      <Bloc t={['RECORDS PERSONNELS', 'PERSONAL BESTS']}>
        <div className="grid grid-cols-3 gap-2">
          {EPREUVES.map(ep => (
            <div key={ep} className="rounded-xl bg-white/5 p-2 text-center">
              <div className="text-[10px] font-black text-white/50">{ep} M</div>
              <div className="font-black tabular-nums text-lg">{a.records?.[ep] ? a.records[ep]!.toFixed(2) : '—'}</div>
            </div>
          ))}
        </div>
      </Bloc>
      {a.palmares.length > 0 && (
        <Bloc t={['PALMARÈS', 'RESULTS']}>
          {a.palmares.slice(0, 6).map((r, i) => (
            <div key={i} className="flex justify-between text-[12px] py-0.5">
              <span className="truncate text-white/80">S{r.s} · {r.meeting ?? mot(COMPETITIONS[r.niveau].cle)} · {libelleEpreuve(r.epreuve)}</span>
              <span className="tabular-nums font-bold shrink-0">{r.chrono === null ? mot('faux') : `${r.place}${r.place === 1 ? 'er' : 'e'} · ${r.chrono.toFixed(2)}`}</span>
            </div>
          ))}
        </Bloc>
      )}
      <Bloc t={['NOTORIÉTÉ', 'PROFILE']}>
        <div className="flex gap-4 text-sm"><span>★ {a.reputation}</span><span>{dans(['Abonnés', 'Followers'])} {a.abonnes.toLocaleString()}</span>{a.sponsors.length > 0 && <span>{dans(['Sponsors', 'Sponsors'])} {a.sponsors.length}</span>}</div>
      </Bloc>
    </div>
  );
}

function ClassementApp({ a }: { a: Athlete }) {
  const [ep, setEp] = useState<Epreuve>(a.specialite || '100');
  const c = classement(a, ep);
  const top = c.lignes.slice(0, 10);
  return (
    <div className="flex flex-col gap-3 p-3 text-white">
      <div className="flex gap-2">
        {EPREUVES.map(e => (
          <button key={e} onClick={() => setEp(e)} className={`flex-1 rounded-xl py-2 text-sm font-black ${ep === e ? 'text-black' : 'bg-white/10 text-white'}`} style={ep === e ? { background: VERT } : undefined}>{e} m</button>
        ))}
      </div>
      <div className="text-[12px] text-white/60">{dans(['Bilan de la saison', 'Season list'])} · {dans(c.categorie)} · {dans(['Val-de-Reuil et alentours', 'Val-de-Reuil and around'])}</div>
      {c.moi.temps === null
        ? <div className="rounded-xl bg-white/5 p-3 text-[13px] text-white/70">{dans(['Cours une compétition sur cette épreuve pour entrer au classement.', 'Race this event in a meet to get on the list.'])}</div>
        : <div className="rounded-xl p-3 font-black text-lg" style={{ background: `${VERT}22`, color: VERT }}>#{c.moi.rang} / {c.total} · {c.moi.temps!.toFixed(2)}</div>}
      <div className="rounded-2xl bg-white/5 overflow-hidden">
        {[...top, ...(c.moi.rang > 10 && c.moi.temps !== null ? [c.moi] : [])].map(l => (
          <div key={l.rang} className={`flex items-center gap-3 px-3 py-2 text-[13px] border-b border-white/5 ${l.moi ? 'font-black' : ''}`} style={l.moi ? { background: `${VERT}22`, color: VERT } : undefined}>
            <span className="w-7 tabular-nums text-white/50">{l.rang}</span>
            <span className="flex-1 truncate">{l.nom}</span>
            <span className="tabular-nums">{l.temps?.toFixed(2) ?? '—'}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Banque({ a }: { a: Athlete }) {
  const l = a.compte || [];
  const semaine = l.filter(x => x.s === a.semaine);
  const entrees = semaine.filter(x => x.m > 0).reduce((s, x) => s + x.m, 0), sorties = semaine.filter(x => x.m < 0).reduce((s, x) => s + x.m, 0);
  return (
    <div className="flex flex-col gap-3 p-4 text-white">
      <div className="rounded-3xl p-4" style={{ background: 'linear-gradient(140deg,#0F766E,#134E4A)' }}>
        <div className="text-[11px] font-bold text-white/70">{dans(['SOLDE', 'BALANCE'])}</div>
        <div className={`font-black text-4xl tabular-nums ${a.argent < 0 ? 'text-red-300' : ''}`}>{mot('argent', { n: a.argent })}</div>
        <div className="flex gap-4 mt-2 text-[12px]"><span className="text-emerald-200">+{entrees} € {dans(['cette semaine', 'this week'])}</span><span className="text-red-200">{sorties} €</span></div>
      </div>
      {!l.length ? <Vide t={['Aucune opération.', 'No transactions.']} /> : (
        <div className="rounded-2xl bg-white/5 overflow-hidden">
          {l.map((x, i) => (
            <div key={i} className="flex items-center justify-between px-3 py-2.5 border-b border-white/5 text-[13px]">
              <span className="flex flex-col"><span>{dans([x.fr, x.en])}</span><span className="text-[10px] text-white/40">S{x.s} · {dans(JOURS[x.j])}</span></span>
              <span className={`font-black tabular-nums ${x.m > 0 ? 'text-emerald-300' : 'text-white'}`}>{x.m > 0 ? '+' : ''}{x.m} €</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Contacts({ a, nom, changer }: { a: Athlete; nom: (l: Lieu) => string; changer: (f: () => void) => void }) {
  const [bulle, setBulle] = useState<{ p: Personne; t: [string, string] } | null>(null);
  return (
    <div className="flex flex-col">
      {PERSONNES.filter(p => (p !== 'coach' && p !== 'partenaire') || a.club).map(p => {
        const v = lienDe(a, p), l = ouEst(a, p);
        return (
          <div key={p} className="px-4 py-3 border-b border-white/5 text-white">
            <div className="flex items-center gap-3">
              <span className="w-10 h-10 shrink-0 rounded-full flex items-center justify-center font-black" style={{ background: couleurAuteur(p) }}>{dans(GENS[p].nom(a)).replace(/^(Ta |Ton |M\. |Mme |Coach |Your |Mr |Ms )/, '').charAt(0).toUpperCase()}</span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-black truncate">{dans(GENS[p].nom(a))}</span>
                <span className="block text-[11px] text-white/55 truncate">{dans(roleDe(a, p))} · {dans(etiquette(v))} · {l ? nom(l as Lieu) : dans(['ailleurs', 'elsewhere'])}</span>
              </span>
              <button onClick={() => changer(() => { const r = interagir(a, p, 'discuter'); setBulle({ p, t: r.replique || r.refus || ['…', '…'] }); })}
                      aria-label={dans(['Appeler', 'Call'])} className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: VERT }}>
                <Phone size={18} color="#000" />
              </button>
            </div>
            {bulle?.p === p && <div className="mt-2 ml-13 rounded-2xl bg-white text-[#10251C] px-3 py-2 text-[13px] font-semibold">{dans(bulle.t)}</div>}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ la carte */

const COULEURS_CARTE: Record<string, string> = { herbe: '#2F5D3A', bois: '#244A2E', terrain: '#33653D', jeux: '#4A4636', champ: '#4C4A2E', ecole: '#2E3D33', dalle: '#3A3A3A' };

function CarteApp({ a, ville, nom, vise, setVise, aller }: {
  a: Athlete; ville: Ville | null; nom: (l: Lieu) => string; vise: Lieu | null; setVise: (l: Lieu | null) => void; aller: (l: Lieu, mode: Mode) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [d, setD] = useState<Donnees | null>(null);
  const [, maj] = useReducer((x: number) => x + 1, 0);
  const lieux = (Object.keys(LIEUX) as Lieu[]).filter(l => ville?.porte(l));
  useEffect(() => { chargerVille().then(setD); }, []);
  // le cadre : toute la ville, ou centre sur le joueur et le lieu vise
  const vue = useRef({ cx: 0, cz: 0, k: 0.12 });

  useEffect(() => {
    const cv = ref.current; if (!cv || !d) return;
    const dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const c = cv.getContext('2d')!; c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const v = vue.current;
    if (!v.k || v.k === 0.12) {
      const moi = ville?.position() || [0, 0];
      v.cx = moi[0]; v.cz = moi[1]; v.k = Math.min(W, H) / 1100;
    }
    const X = (x: number) => W / 2 + (x - v.cx) * v.k, Z = (z: number) => H / 2 + (z - v.cz) * v.k;
    c.fillStyle = '#1B2620'; c.fillRect(0, 0, W, H);
    const poly = (p: [number, number][], couleur: string) => { c.fillStyle = couleur; c.beginPath(); p.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.closePath(); c.fill(); };
    for (const g of d.vert) poly(g.p, COULEURS_CARTE[g.k] || '#2F5D3A');
    for (const e of d.eau) poly(e, '#2B5F86');
    c.lineCap = 'round'; c.lineJoin = 'round';
    for (const r of d.routes) {
      const piste = r.w < 4;
      c.strokeStyle = piste ? 'rgba(220,210,190,0.35)' : '#9AA3AD'; c.lineWidth = Math.max(piste ? 0.8 : 1.4, r.w * v.k);
      c.beginPath(); r.l.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.stroke();
    }
    c.strokeStyle = '#6B5E54'; c.lineWidth = 2; c.setLineDash([4, 4]);
    for (const r of d.rails) { c.beginPath(); r.l.forEach(([x, z], i) => (i ? c.lineTo(X(x), Z(z)) : c.moveTo(X(x), Z(z)))); c.stroke(); }
    c.setLineDash([]);
    for (const b of d.batiments) poly(b.p, '#C9C2B4');
    for (const t of d.pistes) if (t.ferme) poly(t.p, '#C8553D');
    // les lieux du jeu
    c.font = '700 10px system-ui'; c.textAlign = 'center';
    for (const l of lieux) {
      const [x, z] = ville!.porte(l)!, sx = X(x), sz = Z(z), choisi = l === vise;
      c.fillStyle = choisi ? '#FFFFFF' : VERT; c.beginPath(); c.arc(sx, sz, choisi ? 8 : 6, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#0B1A12'; c.lineWidth = 2; c.stroke();
      const t = nom(l), w = c.measureText(t).width + 10;
      c.fillStyle = choisi ? '#FFFFFF' : 'rgba(8,18,14,0.85)'; c.beginPath(); c.roundRect(sx - w / 2, sz - 24, w, 15, 7); c.fill();
      c.fillStyle = choisi ? '#0B1A12' : '#FFFFFF'; c.fillText(t, sx, sz - 13);
    }
    // toi
    const moi = ville?.position();
    if (moi) {
      c.fillStyle = 'rgba(59,130,246,0.25)'; c.beginPath(); c.arc(X(moi[0]), Z(moi[1]), 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#3B82F6'; c.strokeStyle = '#fff'; c.lineWidth = 3; c.beginPath(); c.arc(X(moi[0]), Z(moi[1]), 7, 0, Math.PI * 2); c.fill(); c.stroke();
    }
  });

  // toucher : un lieu, ou faire glisser la carte ; deux doigts ou la molette : zoomer
  const tir = useRef<{ x: number; y: number; cx: number; cz: number; bouge: boolean } | null>(null);
  const toucher = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect(), v = vue.current;
    const x = (e.clientX - r.left - r.width / 2) / v.k + v.cx, z = (e.clientY - r.top - r.height / 2) / v.k + v.cz;
    let best: Lieu | null = null, bd = 26 / v.k;
    for (const l of lieux) { const [px, pz] = ville!.porte(l)!; const dd = Math.hypot(px - x, pz - z); if (dd < bd) { bd = dd; best = l; } }
    setVise(best);
  };

  const metres = vise && ville ? Math.round((ville.distance(vise) || 0) * 1.3) : 0;
  return (
    <div className="relative h-full min-h-[480px]">
      <canvas ref={ref} className="absolute inset-0 w-full h-full touch-none"
              onPointerDown={e => { tir.current = { x: e.clientX, y: e.clientY, cx: vue.current.cx, cz: vue.current.cz, bouge: false }; }}
              onPointerMove={e => {
                const t = tir.current; if (!t) return;
                if (Math.hypot(e.clientX - t.x, e.clientY - t.y) > 6) t.bouge = true;
                if (t.bouge) { vue.current.cx = t.cx - (e.clientX - t.x) / vue.current.k; vue.current.cz = t.cz - (e.clientY - t.y) / vue.current.k; maj(); }
              }}
              onPointerUp={e => { if (tir.current && !tir.current.bouge) toucher(e); tir.current = null; }}
              onWheel={e => { vue.current.k = Math.min(1.2, Math.max(0.05, vue.current.k * (e.deltaY > 0 ? 0.88 : 1.14))); maj(); }} />
      <div className="absolute right-2 top-2 flex flex-col gap-1">
        {['+', '−'].map((s, i) => (
          <button key={s} onClick={() => { vue.current.k = Math.min(1.2, Math.max(0.05, vue.current.k * (i ? 0.75 : 1.33))); maj(); }}
                  className="w-9 h-9 rounded-xl bg-black/60 text-white font-black text-lg">{s}</button>
        ))}
      </div>
      {vise && (
        <div className="absolute inset-x-2 bottom-2 rounded-2xl bg-[#0F1412]/95 border border-white/10 p-3 text-white">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-black">{nom(vise)}</span>
            <span className="text-[11px] text-white/55">{LIEUX[vise].vrai || 'Val-de-Reuil'} · {metres} m</span>
          </div>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {([['pied', Footprints, ['À pied', 'Walk']], ['velo', Bike, ['Vélo', 'Bike']], ['bus', Bus, ['Bus', 'Bus']]] as [Mode, typeof Bus, [string, string]][]).map(([m, I, t]) => {
              const tr = trajet(a, m, metres);
              return (
                <button key={m} disabled={!!tr.refus} onClick={() => aller(vise, m)}
                        className="rounded-xl bg-white/10 enabled:hover:bg-white/15 disabled:opacity-35 p-2 flex flex-col items-center gap-0.5">
                  <I size={18} />
                  <span className="text-[11px] font-black">{dans(t)}</span>
                  <span className="text-[10px] text-white/60 tabular-nums">{tr.refus ? dans(tr.refus) : `${tr.minutes} min${tr.prix ? ` · ${tr.prix} €` : ''}`}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ petits morceaux */

function Bloc({ t, children }: { t: [string, string]; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-white/5 p-3 flex flex-col gap-1.5">
      <span className="text-[10px] font-black tracking-[0.2em] text-white/50">{dans(t)}</span>
      {children}
    </div>
  );
}
const Vide = ({ t }: { t: [string, string] }) => <div className="p-6 text-center text-sm text-white/50">{dans(t)}</div>;
