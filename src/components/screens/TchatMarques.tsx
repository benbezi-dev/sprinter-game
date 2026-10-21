import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, useDragControls, useMotionValue, animate } from 'motion/react';
import { Loader2, Send, X, AtSign, Lock, UserPlus, Check, Flag, Ban, Bell, MessageCircle, Search, ChevronDown, BadgeCheck, Heart } from 'lucide-react';
import { FEUILLE, VOILE, RESSORT, useAnimationsReduites } from '@/lib/mouvement';
import { useRetour } from '@/hooks/use-retour';
import { surCourrier, reprendreTouchee } from '@/game/boite';
import { getSavedName } from '@/game/leaderboard';
import { SprinterApp } from '@/game/engine';
import { ecouterInstall, installVisible } from './InstallPrompt';
import { etatPush, activerPush } from '@/game/push';
import { bloquer, MOTIFS, type Motif } from '@/game/moderation';
import { NOM_CAMP, type Camp } from '@/game/marques';
import {
  lireTchat, ecrire, signalerMessage, lireInvitables, inviter, poserVu, dernierVu,
  ecrireOfficiel, aLaCleOfficielle, aimerMessage, marquerLu as marquerLuServeur,
  type Message, type Lu, type Participant, type Invitation, type Invitable, type Refus,
} from '@/game/tchat-marques';
import { usePresences, parNom, type Present } from '@/game/presence';
import { PointPresence } from './PointPresence';

/* ---------------------------------------------------------------------------
   LE TCHAT DU DUEL DES MARQUES (13/10/2026) — voir game/tchat-marques.ts et
   worker/src/tchat-marques.js.

   Trois onglets : TOUS (le tchat commun des deux camps), PRIVÉS (une
   conversation par personne), INVITER (le top 500 qui n'a pas encore choisi
   son camp). Designer quelqu'un, c'est toucher son nom — jamais taper
   « @nom », que le filtre refuse.

   Le tchat se relit toutes les quatre secondes tant qu'il est ouvert, et
   tout de suite quand la boite sonne (un prive, une designation).

   Les J'AIME (17/10) : un double tap sur le message, qui fait eclore un
   grand coeur. Le petit coeur rouge et son compteur n'apparaissent qu'avec
   des j'aime ; le toucher retire le sien. Le compteur se voit aussi sous les siens.

   Les PRIVES LUS (18/10) : une conversation est non lue tant qu'un message
   recu de l'autre n'a pas ete vu — ouverte, tiroir deplie — ni suivi d'une
   reponse. Ouvrir la marque lue sur le serveur, qui rend ses marques a chaque
   lecture : elles tiennent a la relecture, a la reouverture, au redemarrage.

   Le compte SPRINTERGAME (16/10) : la voix du jeu, d'aucun camp. Ses messages
   portent un badge et une teinte a eux ; on ne peut ni lui repondre, ni le
   signaler, ni le bloquer. Le telephone qui porte sa cle (tchat-officiel.ts)
   ecrit en son nom dans TOUS, ou sous son propre nom d'un geste.

   APRES LE DUEL (16/10), le tchat reste : il devient le TCHAT du jeu, ouvert
   a tout nom reserve, depuis l'accueil (`TchatDuJeu`, plus bas). Plus de
   camps ni d'invitations ; les messages du duel restent dans le fil.
--------------------------------------------------------------------------- */

const TEINTE: Record<Camp | 'sprinter' | 'joueur', string> = { adidas: '#FFFFFF', nike: '#FFD426', sprinter: '#5CC8FF', joueur: '#C8CDD6' };
const RELIRE_MS = 4000;
const RELIRE_REPLIE_MS = 15000;
/** Replie sur l'accueil, chez tous les joueurs : une relecture par minute suffit a la pastille. */
const RELIRE_REPLIE_ACCUEIL_MS = 60000;
const MAX = 140;
/** La cle d'un nom, comme le serveur la forme (tchat-marques.js, `cle`). */
const cleDe = (nom: string) => nom.trim().toLowerCase().slice(0, 40);

type Onglet = 'tous' | 'prives' | 'inviter';

function texteRefus(r: Refus, raison: string | undefined, fr: boolean): string {
  if (r === 'filtre') {
    const t: Record<string, [string, string]> = {
      lien: ['Pas de lien dans le tchat.', 'No links in the chat.'],
      contact: ['Pas de @pseudo, de numéro ni de compte d’un autre réseau.', 'No @handles, numbers or other social accounts.'],
      grossier: ['Ce message ne passe pas le filtre.', 'This message does not pass the filter.'],
      long: [`${MAX} caractères au plus.`, `${MAX} characters at most.`],
      vide: ['Écris quelque chose.', 'Write something.'],
    };
    const x = t[raison || ''] || t.grossier;
    return fr ? x[0] : x[1];
  }
  const t: Record<Refus, [string, string]> = {
    nom: ['Ce nom appartient à un autre appareil : récupère-le avec ton code pour écrire.', 'This name belongs to another device: recover it with your code to write.'],
    imite: ['Ce nom est celui du jeu : choisis-en un autre pour écrire.', 'This is the game’s name: pick another one to write.'],
    cle: ['La clé SprinterGame est refusée : elle a été oubliée sur ce téléphone.', 'The SprinterGame key was refused and has been removed from this phone.'],
    camp: ['Choisis ton camp pour écrire dans le tchat.', 'Pick your side to write in the chat.'],
    filtre: ['', ''],
    vite: ['Doucement : quelques secondes entre deux messages.', 'Easy: a few seconds between two messages.'],
    jour: ['Tu as atteint la limite du jour.', 'You reached today’s limit.'],
    absent: ['Cette personne n’est pas dans le duel.', 'This person is not in the duel.'],
    banni: ['Tu ne peux plus écrire dans le tchat.', 'You can no longer write in the chat.'],
    top: ['Seul le top 500 peut être invité.', 'Only the top 500 can be invited.'],
    reseau: ['Le tchat ne répond pas. Réessaie dans un instant.', 'The chat is not answering. Try again in a moment.'],
  };
  return fr ? t[r][0] : t[r][1];
}

function heure(quand: number, fr: boolean) {
  return new Date(quand).toLocaleTimeString(fr ? 'fr-FR' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Le tchat : lecture continue, fusion des messages.
 *
 * Replie, il se relit plus lentement (la barre n'annonce que les non-lus) et
 * ne reserve pas le nom : seul le geste de deplier le tchat le fait.
 */
function useTchat(deplie: boolean, replieMs = RELIRE_REPLIE_MS) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [refus, setRefus] = useState<Refus | null>(null);
  const [charge, setCharge] = useState(false);
  // les conversations privees lues : cle de l'autre -> dernier message vu
  const [lus, setLus] = useState<Map<string, number>>(() => new Map());
  const dernier = useRef(0);
  const enCours = useRef(false);
  const enVol = useRef(new Set<number>());   // les coeurs touches, en route
  const ouvert = useRef(deplie);
  ouvert.current = deplie;

  const relire = useCallback(async (tout = false) => {
    if (enCours.current) return;
    enCours.current = true;
    const r = await lireTchat(dernier.current, tout || !dernier.current, ouvert.current);
    enCours.current = false;
    if ('refus' in r) { setRefus(r.refus); setCharge(true); return; }
    setRefus(null);
    setCharge(true);
    if (r.participants) setParticipants(r.participants);
    if (r.invitations) setInvitations(r.invitations);
    if (r.lus) poserLus(r.lus);
    if (r.messages.length) dernier.current = Math.max(dernier.current, r.dernier);
    // Les j'aime arrivent sur des messages deja recus : on les repose a chaque
    // lecture, sauf sur un message qu'on vient de toucher (la reponse arrive).
    const aimes = new Map((r.aimes || []).map(a => [a.id, a]));
    setMessages(m => {
      const vus = new Set(m.map(x => x.id));
      const neufs = r.messages.filter(x => !vus.has(x.id));
      if (!neufs.length && !r.aimes) return m;
      return [...m, ...neufs].slice(-300).map(x => {
        if (enVol.current.has(x.id)) return x;
        const a = aimes.get(x.id);
        const n = a ? a.n : 0, moi = a ? a.moi : false;
        return (x.aimes || 0) === n && !!x.aime === moi ? x : { ...x, aimes: n, aime: moi };
      });
    });
  }, []);

  // Une marque ne recule jamais : on garde la plus avancee, d'ici ou du serveur.
  const poserLus = useCallback((liste: Lu[]) => setLus(l => {
    let n: Map<string, number> | null = null;
    for (const x of liste) {
      if (x.id > (l.get(x.avec) || 0)) (n ??= new Map(l)).set(x.avec, x.id);
    }
    return n || l;
  }), []);
  // Ouvrir une conversation la marque lue : tout de suite a l'ecran, puis
  // sur le serveur, qui la rendra aux lectures suivantes et au redemarrage.
  const marquerLu = useCallback(async (avec: string, jusqua: number) => {
    poserLus([{ avec: cleDe(avec), id: jusqua }]);
    const r = await marquerLuServeur(avec, jusqua);
    if (r) poserLus([r]);
  }, [poserLus]);

  // Un coeur touche : tout de suite a l'ecran, puis le compteur du serveur.
  const poser = (id: number, aimes: number, aime: boolean) =>
    setMessages(x => x.map(m => (m.id === id ? { ...m, aimes, aime } : m)));
  const aimer = useCallback(async (m: Message) => {
    if (m.a_moi || enVol.current.has(m.id)) return;
    const veut = !m.aime;
    enVol.current.add(m.id);
    poser(m.id, Math.max(0, (m.aimes || 0) + (veut ? 1 : -1)), veut);
    const r = await aimerMessage(m.id, veut);
    enVol.current.delete(m.id);
    if (r) poser(m.id, r.aimes, r.aime); else poser(m.id, m.aimes || 0, !!m.aime);
  }, []);

  useEffect(() => {
    relire(true);
    const minuterie = setInterval(() => { if (document.visibilityState === 'visible') relire(); },
      deplie ? RELIRE_MS : replieMs);
    const quitter = surCourrier(q => { if (q === 'marques_tchat') relire(); });
    return () => { clearInterval(minuterie); quitter(); };
  }, [relire, deplie, replieMs]);

  const ajouter = (m: Message) => setMessages(x => (x.some(y => y.id === m.id) ? x : [...x, m]));
  const oter = (de: string) => setMessages(x => x.filter(m => m.de.toLowerCase() !== de.toLowerCase()));
  return { messages, participants, invitations, refus, charge, lus, relire, ajouter, oter, aimer, marquerLu };
}

/** Une ligne du tchat. */
function Ligne({ m, fr, present, onMenu, onAimer }: { m: Message; fr: boolean; present?: Present; onMenu: (m: Message) => void; onAimer: (m: Message) => void }) {
  const vise = m.pour_moi;
  // SprinterGame : on ne lui repond pas, on ne le signale ni ne le bloque —
  // mais on peut l'aimer
  const touchable = !m.a_moi && !m.officiel;
  const n = m.aimes || 0;
  // Le double tap (17/10) : deux touches rapprochees sur le message l'aiment,
  // au doigt comme a la souris — le `dblclick` ne vient pas sur tous les
  // telephones. Il aime seulement, comme ailleurs : le coeur, lui, retire.
  const derniere = useRef(0);
  const [eclat, setEclat] = useState(0);
  const taper = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    const t = e.timeStamp;
    if (t - derniere.current < 320) {
      derniere.current = 0;
      window.getSelection()?.removeAllRanges();
      if (m.a_moi) return;
      setEclat(x => x + 1);
      if (!m.aime) onAimer(m);
    } else derniere.current = t;
  };
  return (
    <motion.li initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      onPointerUp={taper}
      className={`relative touch-manipulation group flex flex-col px-2.5 py-1.5 rounded-xl text-sm leading-snug
                  ${m.officiel ? 'bg-[#5CC8FF]/10 border border-[#5CC8FF]/35'
                    : vise ? 'bg-primary/15 border border-primary/40' : m.a_moi ? 'bg-white/5' : ''}`}>
      <span className="flex items-baseline gap-1.5 text-[11px] min-w-0">
        <button onClick={() => touchable && onMenu(m)} disabled={!touchable}
                className="font-black truncate max-w-[45%] hover:underline disabled:hover:no-underline"
                style={{ color: TEINTE[m.camp] ?? TEINTE.sprinter }}>
          {m.de}
        </button>
        <PointPresence p={present} />
        {m.officiel && (
          <span className="self-center flex items-center gap-0.5 px-1.5 py-px rounded-full bg-[#5CC8FF] text-black text-[9px] font-black tracking-wider shrink-0">
            <BadgeCheck className="w-2.5 h-2.5" aria-hidden />{fr ? 'OFFICIEL' : 'OFFICIAL'}
          </span>
        )}
        {m.prive && <Lock className="w-3 h-3 text-muted-foreground shrink-0" aria-label={fr ? 'privé' : 'private'} />}
        {m.pour && (
          <span className="text-muted-foreground truncate">
            → <span className={vise ? 'text-primary font-bold' : ''}>{m.pour}</span>
          </span>
        )}
        <span className="ml-auto text-muted-foreground/60 shrink-0">{heure(m.quand, fr)}</span>
      </span>
      <AnimatePresence>
        {eclat > 0 && (
          <motion.span key={eclat} aria-hidden
            initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: [0.3, 1.25, 1], opacity: [0, 1, 1] }}
            exit={{ scale: 1.4, opacity: 0 }} transition={{ duration: 0.35 }}
            onAnimationComplete={() => setTimeout(() => setEclat(x => (x === eclat ? 0 : x)), 250)}
            className="pointer-events-none absolute inset-0 flex items-center justify-center text-[#FF4D6D]">
            <Heart className="w-9 h-9 drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]" fill="currentColor" />
          </motion.span>
        )}
      </AnimatePresence>
      <span className="flex items-end gap-2">
        <span className="flex-1 min-w-0 break-words whitespace-pre-wrap text-foreground/90">{m.texte}</span>
        {/* Pas de coeur vide (17/10) : il n'apparait, rouge, qu'avec des j'aime.
            On aime d'un double tap ; toucher le coeur retire ou ajoute le sien. */}
        {n > 0 && (
          <button onClick={() => onAimer(m)} disabled={m.a_moi}
                  aria-pressed={!!m.aime}
                  aria-label={m.aime ? (fr ? 'Je n’aime plus' : 'Unlike') : (fr ? 'J’aime' : 'Like')}
                  className="shrink-0 -mb-0.5 flex items-center gap-0.5 px-1 py-0.5 rounded-md text-[10px] font-bold text-[#FF4D6D]">
            <motion.span key={m.aime ? 'oui' : 'non'} initial={m.aime ? { scale: 0.4 } : false} animate={{ scale: 1 }}
                         transition={RESSORT.trophee} className="flex">
              <Heart className="w-3.5 h-3.5" fill="currentColor" aria-hidden />
            </motion.span>
            <span>{n}</span>
          </button>
        )}
      </span>
    </motion.li>
  );
}

/** La liste des inscrits, pour designer quelqu'un ou lui ecrire. */
function ChoixPersonne({ participants, moi, fr, titre, presenceDe, onChoix, onClose }: {
  participants: Participant[]; moi: string; fr: boolean; titre: string;
  presenceDe: (nom: string) => Present | undefined;
  onChoix: (p: Participant) => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const liste = participants
    .filter(p => p.name.toLowerCase() !== moi)
    .filter(p => !q || p.name.toLowerCase().includes(q.trim().toLowerCase()))
    .slice(0, 200);
  return (
    <motion.div {...VOILE} className="fixed inset-0 z-[70] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <motion.div {...FEUILLE} onClick={e => e.stopPropagation()}
        className="w-full max-w-md max-h-[75vh] flex flex-col rounded-t-3xl md:rounded-3xl bg-card border border-white/10 p-4 gap-3">
        <div className="flex items-center justify-between">
          <h3 className="font-black font-display text-sm tracking-widest">{titre}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10"><X className="w-4 h-4" /></button>
        </div>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60 border border-white/10">
          <Search className="w-4 h-4 text-muted-foreground" aria-hidden />
          <input value={q} onChange={e => setQ(e.target.value)} autoFocus
                 placeholder={fr ? 'Chercher un coureur' : 'Find a runner'}
                 className="flex-1 bg-transparent outline-none text-sm" />
        </label>
        <ul className="flex-1 overflow-y-auto flex flex-col gap-0.5">
          {liste.map(p => (
            <li key={p.name}>
              <button onClick={() => onChoix(p)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-white/10 text-left">
                <span className="font-bold truncate" style={{ color: TEINTE[p.camp] }}>{p.name}</span>
                <PointPresence p={presenceDe(p.name)} />
                {p.camp !== 'joueur' && (
                  <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
                    {NOM_CAMP[p.camp]} · {p.epreuve} m
                  </span>
                )}
              </button>
            </li>
          ))}
          {!liste.length && <li className="text-xs text-muted-foreground text-center py-6">{fr ? 'Personne' : 'Nobody'}</li>}
        </ul>
      </motion.div>
    </motion.div>
  );
}

/** Ce qu'on peut faire d'un message d'un autre : designer, ecrire, signaler, bloquer. */
function MenuMessage({ m, fr, onDesigner, onPrive, onClose, onBloque }: {
  m: Message; fr: boolean;
  onDesigner: () => void; onPrive: () => void; onClose: () => void; onBloque: () => void;
}) {
  const [etape, setEtape] = useState<'menu' | 'motif' | 'fait'>('menu');
  const signaler = async (motif: Motif) => {
    await signalerMessage(m.id, motif);
    setEtape('fait');
  };
  const MOTIF: Record<Motif, [string, string]> = {
    insulte: ['Insulte', 'Insult'], haine: ['Haine', 'Hate'], sexuel: ['Sexuel', 'Sexual'],
    menace: ['Menace', 'Threat'], autre: ['Autre', 'Other'],
  };
  const Bouton = ({ icone, texte, onClick, danger }: { icone: React.ReactNode; texte: string; onClick: () => void; danger?: boolean }) => (
    <button onClick={onClick}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/10 text-sm text-left ${danger ? 'text-red-400' : ''}`}>
      {icone}{texte}
    </button>
  );
  return (
    <motion.div {...VOILE} className="fixed inset-0 z-[70] bg-black/60 flex items-end md:items-center justify-center" onClick={onClose}>
      <motion.div {...FEUILLE} onClick={e => e.stopPropagation()}
        className="w-full max-w-md rounded-t-3xl md:rounded-3xl bg-card border border-white/10 p-3 flex flex-col gap-1">
        <p className="px-3 pt-1 pb-2 text-xs text-muted-foreground truncate">
          <span className="font-black" style={{ color: TEINTE[m.camp] }}>{m.de}</span> · {m.texte}
        </p>
        {etape === 'menu' && (
          <>
            <Bouton icone={<AtSign className="w-4 h-4" />} texte={fr ? `Répondre à ${m.de} (dans le tchat)` : `Reply to ${m.de} (in the chat)`} onClick={onDesigner} />
            <Bouton icone={<Lock className="w-4 h-4" />} texte={fr ? `Message privé à ${m.de}` : `Private message to ${m.de}`} onClick={onPrive} />
            <Bouton icone={<Flag className="w-4 h-4" />} texte={fr ? 'Signaler ce message' : 'Report this message'} onClick={() => setEtape('motif')} danger />
            <Bouton icone={<Ban className="w-4 h-4" />} texte={fr ? `Bloquer ${m.de}` : `Block ${m.de}`}
                    onClick={async () => { await bloquer(m.de); onBloque(); }} danger />
          </>
        )}
        {etape === 'motif' && MOTIFS.map(x => (
          <Bouton key={x} icone={<Flag className="w-4 h-4" />} texte={fr ? MOTIF[x][0] : MOTIF[x][1]} onClick={() => signaler(x)} />
        ))}
        {etape === 'fait' && (
          <p className="px-3 py-4 text-sm text-center">
            {fr ? 'Merci. Un humain va relire ce message.' : 'Thanks. A human will review this message.'}
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}

/** La carte « active les notifications », tant que ce telephone peut les recevoir mais ne les a pas. */
function CarteNotifications({ fr }: { fr: boolean }) {
  const [etat, setEtat] = useState<string | null>(null);
  useEffect(() => { etatPush().then(setEtat).catch(() => setEtat(null)); }, []);
  if (etat !== 'a-demander') return null;
  return (
    <button onClick={async () => { await activerPush(); setEtat(await etatPush()); }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-primary/15 border border-primary/40 text-xs text-left">
      <Bell className="w-4 h-4 text-primary shrink-0" aria-hidden />
      {fr ? 'Active les notifications : ton téléphone vibrera quand on t’écrit ou qu’on te désigne.'
          : 'Turn on notifications: your phone buzzes when someone writes to you or mentions you.'}
    </button>
  );
}

/** L'onglet INVITER : le top 500 qui n'a pas encore choisi son camp. */
function Inviter({ fr }: { fr: boolean }) {
  const [liste, setListe] = useState<Invitable[] | null>(null);
  const [refus, setRefus] = useState<Refus | null>(null);
  const [q, setQ] = useState('');
  const [enRoute, setEnRoute] = useState<string | null>(null);
  useEffect(() => {
    lireInvitables().then(r => { if (Array.isArray(r)) setListe(r); else setRefus(r.refus); });
  }, []);
  const go = async (nom: string) => {
    setEnRoute(nom);
    const r = await inviter(nom);
    setEnRoute(null);
    if (r === true) { setRefus(null); setListe(l => l && l.map(x => (x.name === nom ? { ...x, invite: true } : x))); }
    else setRefus(r.refus);
  };
  const vue = (liste || []).filter(x => !q || x.name.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 150);
  return (
    <div className="flex-1 min-h-0 flex flex-col gap-2">
      <p className="text-[11px] text-muted-foreground leading-snug">
        {fr ? 'Invite un joueur du top 500 (100, 200 ou 400 m) qui n’a pas encore choisi son camp. Son téléphone vibre. Quinze invitations par jour.'
            : 'Invite a top-500 player (100, 200 or 400 m) who has not picked a side yet. Their phone buzzes. Fifteen invitations a day.'}
      </p>
      <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-background/60 border border-white/10">
        <Search className="w-4 h-4 text-muted-foreground" aria-hidden />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={fr ? 'Chercher dans le top 500' : 'Search the top 500'}
               className="flex-1 bg-transparent outline-none text-sm" />
      </label>
      {refus && <p className="text-xs text-red-400 text-center">{texteRefus(refus, undefined, fr)}</p>}
      {!liste && !refus && <Loader2 className="w-4 h-4 animate-spin mx-auto my-6 text-muted-foreground" />}
      <ul className="flex-1 overflow-y-auto flex flex-col gap-0.5">
        {vue.map(x => (
          <li key={x.name} className="flex items-center gap-2 px-3 py-1.5 rounded-xl hover:bg-white/5">
            <span className="truncate text-sm">{x.name}</span>
            <button onClick={() => go(x.name)} disabled={x.invite || !!enRoute}
                    className="ml-auto shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-black tracking-wider
                               bg-white text-black disabled:bg-white/10 disabled:text-foreground/60">
              {enRoute === x.name ? <Loader2 className="w-3 h-3 animate-spin" />
                : x.invite ? <><Check className="w-3 h-3" />{fr ? 'INVITÉ' : 'INVITED'}</>
                : <><UserPlus className="w-3 h-3" />{fr ? 'INVITER' : 'INVITE'}</>}
            </button>
          </li>
        ))}
        {liste && !vue.length && <li className="text-xs text-muted-foreground text-center py-6">{fr ? 'Personne à inviter' : 'Nobody to invite'}</li>}
      </ul>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   LA BULLE DU TCHAT, sur l'accueil (demande de l'auteur, 17/10/2026) : le
   bouton TCHAT flotte, et on l'emmene ou l'on veut du doigt. Lachee, elle va
   se coller au bord le plus proche, et ce telephone se souvient ou on l'a
   laissee. Une touche sans la deplacer ouvre le tchat.
--------------------------------------------------------------------------- */
const MARGE_BULLE = 12;
const CLE_BULLE = 'sprinter_tchat_bulle';

type PlaceBulle = { cote: 'g' | 'd'; haut: number };   // haut : 0 (en haut) a 1 (en bas)

function lirePlace(): PlaceBulle {
  try {
    const p = JSON.parse(localStorage.getItem(CLE_BULLE) || 'null');
    if (p && (p.cote === 'g' || p.cote === 'd') && typeof p.haut === 'number') return { cote: p.cote, haut: Math.min(1, Math.max(0, p.haut)) };
  } catch { /* stockage refuse */ }
  return { cote: 'd', haut: 0.82 };
}

function BulleTchat({ fr, nonLus, bas, onOuvrir }: { fr: boolean; nonLus: number; bas: number; onOuvrir: () => void }) {
  const reduit = useAnimationsReduites();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const bouge = useRef(false);
  const el = useRef<HTMLButtonElement>(null);
  const [place, setPlace] = useState(lirePlace);
  const taille = () => ({ w: el.current?.offsetWidth || 40, h: el.current?.offsetHeight || 40 });

  // La ou elle doit etre, en pixels, pour une place et la taille de l'ecran.
  const ou = useCallback((p: PlaceBulle) => {
    const l = window.innerWidth, h = window.innerHeight, t = taille();
    const haut = MARGE_BULLE + 40, basMax = h - t.h - MARGE_BULLE - bas;
    return {
      x: p.cote === 'g' ? MARGE_BULLE : l - t.w - MARGE_BULLE,
      y: haut + p.haut * Math.max(0, basMax - haut),
    };
  }, [bas]);

  useEffect(() => {
    const poser = () => { const c = ou(place); x.set(c.x); y.set(c.y); };
    poser();
    window.addEventListener('resize', poser);
    return () => window.removeEventListener('resize', poser);
  }, [ou, place, x, y]);

  const lacher = () => {
    const l = window.innerWidth, h = window.innerHeight, t = taille();
    const haut = MARGE_BULLE + 40, basMax = h - t.h - MARGE_BULLE - bas;
    const p: PlaceBulle = {
      cote: x.get() + t.w / 2 < l / 2 ? 'g' : 'd',
      haut: Math.min(1, Math.max(0, (y.get() - haut) / Math.max(1, basMax - haut))),
    };
    const c = ou(p);
    const ressort = reduit ? { duration: 0 } : { type: 'spring' as const, stiffness: 420, damping: 32 };
    animate(x, c.x, ressort);
    animate(y, c.y, ressort);
    setPlace(p);
    try { localStorage.setItem(CLE_BULLE, JSON.stringify(p)); } catch { /* stockage refuse */ }
  };

  return (
    <motion.button key="bulle" ref={el}
      drag dragMomentum={false} dragElastic={0}
      onPointerDown={() => { bouge.current = false; }}
      onDragStart={() => { bouge.current = true; }}
      onDragEnd={lacher}
      onClick={() => { if (!bouge.current) onOuvrir(); }}
      initial={reduit ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
      exit={reduit ? { opacity: 0 } : { scale: 0.6, opacity: 0 }} whileTap={{ scale: 0.92 }} whileDrag={{ scale: 1.08 }}
      transition={reduit ? { duration: 0 } : RESSORT.trophee}
      aria-label={fr ? 'Ouvrir le tchat' : 'Open the chat'}
      style={{ x, y }}
      className="fixed left-0 top-0 z-[55] touch-none select-none flex items-center justify-center w-10 h-10
                 rounded-full bg-primary text-black shadow-lg shadow-black/40
                 cursor-grab active:cursor-grabbing">
      {/* Une icone seule (l'auteur, 21/10) : le mot TCHAT en faisait une bulle trop grosse sur l'accueil. */}
      <MessageCircle className="w-5 h-5" aria-hidden />
      {nonLus > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-white text-black text-[10px] flex items-center justify-center">
          {nonLus > 99 ? '99+' : nonLus}
        </span>
      )}
    </motion.button>
  );
}

/**
 * Le tchat est un TIROIR RETRACTABLE (voulu par l'auteur, 13/10) : il
 * n'occupe pas l'ecran. Replie, un bouton qui flotte avec la pastille des
 * non-lus ; deplie, il monte sur les deux tiers bas, et le score reste
 * visible au-dessus. On le redescend en tirant sa poignee, par sa fleche, ou
 * par le retour du systeme. Une notification touchee l'ouvre deplie.
 */
export function TchatMarques({ fr, moi, deplie, onDeplier, ouvrirSur = 'tous', viserLeDernier = false, duel = true }: {
  fr: boolean; moi: { name: string; inscrit: boolean };
  deplie: boolean; onDeplier: (v: boolean) => void; ouvrirSur?: Onglet;
  /** Arrive par une notification : s'ouvrir sur le dernier message qui vise ce joueur. */
  viserLeDernier?: boolean;
  /** Faux : le tchat du jeu, apres le duel — ni camps ni invitations. */
  duel?: boolean;
}) {
  useRetour(() => onDeplier(false), deplie);
  const reduit = useAnimationsReduites();
  const t = useTchat(deplie, duel ? RELIRE_REPLIE_MS : RELIRE_REPLIE_ACCUEIL_MS);
  // Qui est en ligne — meme lecture partagee que l'accueil et le classement
  // (usePresences ne sonde qu'une fois pour tous les ecrans qui la regardent).
  const presences = usePresences();
  const presents = parNom(presences);
  const presenceDe = (nom: string) => presents.get(nom.trim().toLowerCase());
  const onglets: Onglet[] = duel ? ['tous', 'prives', 'inviter'] : ['tous', 'prives'];
  const [onglet, setOnglet] = useState<Onglet>(ouvrirSur);
  useEffect(() => { setOnglet(ouvrirSur); }, [ouvrirSur]);
  const [texte, setTexte] = useState('');
  const [pour, setPour] = useState<string | null>(null);       // designe, dans le tchat commun
  const [avec, setAvec] = useState<string | null>(null);       // la conversation privee ouverte
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [menu, setMenu] = useState<Message | null>(null);
  const [choix, setChoix] = useState<'designer' | 'prive' | null>(null);
  // Ce telephone porte la cle SprinterGame ; `voixDuJeu` : il ecrit en son nom
  const [cleJeu, setCleJeu] = useState(() => aLaCleOfficielle());
  const [voixDuJeu, setVoixDuJeu] = useState(true);
  const fin = useRef<HTMLDivElement>(null);
  const cleMoi = moi.name.trim().toLowerCase();

  const communs = t.messages.filter(m => !m.prive);
  // les conversations privees : une par interlocuteur, la plus recente d'abord.
  // Non lue : un message recu apres la marque du serveur et apres sa propre
  // derniere reponse — repondre, c'est avoir lu ce qui precede.
  const conversations = useMemo(() => {
    const parQui = new Map<string, Message[]>();
    for (const m of t.messages.filter(x => x.prive)) {
      const qui = m.a_moi ? (m.pour || '') : m.de;
      if (!qui) continue;
      const k = cleDe(qui);
      parQui.set(k, [...(parQui.get(k) || []), m]);
    }
    return [...parQui.entries()].map(([k, ms]) => {
      let vu = t.lus.get(k) || 0;
      for (const m of ms) if (m.a_moi && m.id > vu) vu = m.id;
      return {
        k, qui: ms[0].a_moi ? ms[0].pour! : ms[0].de, ms, dernier: ms[ms.length - 1],
        nonLu: ms.some(m => !m.a_moi && m.id > vu),
      };
    }).sort((a, b) => b.dernier.id - a.dernier.id);
  }, [t.messages, t.lus]);
  // La notification ne dit pas si c'etait un prive ou une designation (elle ne
  // porte que son genre) : on va au dernier message qui vise ce joueur, une fois.
  const vise = useRef(!viserLeDernier);
  useEffect(() => {
    if (vise.current || !t.charge) return;
    vise.current = true;
    const m = [...t.messages].reverse().find(x => x.pour_moi && !x.a_moi);
    if (!m) return;
    if (m.prive) { setOnglet('prives'); setAvec(m.de); } else setOnglet('tous');
  }, [t.charge, t.messages]);
  const ouverte = onglet === 'prives' && avec ? conversations.find(c => c.k === cleDe(avec)) : undefined;
  const fil = onglet === 'tous' ? communs : ouverte?.ms || [];
  // la conversation ouverte sous les yeux, tiroir deplie : elle est lue
  const { marquerLu } = t;
  useEffect(() => {
    if (deplie && ouverte?.nonLu) marquerLu(ouverte.qui, ouverte.dernier.id);
  }, [deplie, ouverte?.nonLu, ouverte?.qui, ouverte?.dernier.id, marquerLu]);

  // deplier le tchat, c'est avoir vu ce qu'il porte ; replie, il compte
  const [vuJusqua, setVuJusqua] = useState(() => dernierVu());
  useEffect(() => {
    if (!deplie || !t.messages.length) return;
    const id = t.messages[t.messages.length - 1].id;
    poserVu(id); setVuJusqua(id);
  }, [t.messages, deplie]);
  const nonLus = t.messages.filter(m => m.id > vuJusqua && !m.a_moi).length;
  useEffect(() => { fin.current?.scrollIntoView({ block: 'end', behavior: reduit ? 'auto' : 'smooth' }); }, [fil.length, onglet, avec, reduit]);

  const envoyer = async () => {
    const x = texte.trim();
    if (!x || envoi) return;
    const prive = onglet === 'prives';
    if (prive && !avec) return;
    setEnvoi(true); setErreur(null);
    const r = enJeu ? await ecrireOfficiel(x) : await ecrire(x, prive ? avec : pour, prive);
    setEnvoi(false);
    if ('refus' in r) {
      if (r.refus === 'cle') setCleJeu(false);
      setErreur(texteRefus(r.refus, r.raison, fr)); return;
    }
    t.ajouter(r.message);
    setTexte('');
    setPour(null);
  };

  // SprinterGame n'ecrit que dans TOUS, et n'a pas besoin d'un camp pour cela
  const enJeu = cleJeu && voixDuJeu && onglet === 'tous';
  const peutEcrire = (moi.inscrit || enJeu) && !t.refus && (onglet === 'tous' || !!avec);
  const nonLusPrives = conversations.filter(c => c.nonLu).length;

  const ressort = reduit ? { duration: 0 } : RESSORT.panneau;
  // le tiroir se tire par sa poignee seulement : le fil, lui, defile
  const tirer = useDragControls();
  // La carte « installer le jeu » occupe le bas de l'ecran et passe devant
  // (z-[57]) : tant qu'elle est la, le bouton se pose juste au-dessus d'elle,
  // sans quoi on ne le voit pas (constat du 13/10).
  const [carte, setCarte] = useState(0);
  useEffect(() => {
    const mesurer = () => {
      const el = installVisible() ? document.querySelector('[data-carte-install]') : null;
      setCarte(el ? Math.ceil(el.getBoundingClientRect().height) : 0);
    };
    mesurer();
    const t = setTimeout(mesurer, 400);   // la carte entre en glissant
    const quitter = ecouterInstall(() => { mesurer(); setTimeout(mesurer, 400); });
    return () => { clearTimeout(t); quitter(); };
  }, []);
  // Rendu sur <body> : l'ecran du duel defile et porte une transformation, et
  // un element `fixed` pose dedans defilerait avec lui (vu le 13/10 : le
  // tiroir remontait quand le clavier faisait defiler l'ecran).
  return createPortal(
    <>
      {/* replie : le bouton qui flotte, et sa pastille */}
      <AnimatePresence>
        {!deplie && !duel && (
          <BulleTchat fr={fr} nonLus={nonLus} bas={carte ? carte + 8 : 0} onOuvrir={() => onDeplier(true)} />
        )}
        {!deplie && duel && (
          <motion.button key="bouton" onClick={() => onDeplier(true)}
            initial={reduit ? false : { scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            exit={reduit ? { opacity: 0 } : { scale: 0.6, opacity: 0 }} whileTap={{ scale: 0.94 }}
            transition={reduit ? { duration: 0 } : RESSORT.trophee}
            aria-label={fr ? 'Ouvrir le tchat' : 'Open the chat'}
            style={carte ? { bottom: carte + 8 } : undefined}
            className="fixed z-[55] right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] flex items-center gap-2 pl-3 pr-4 py-2.5
                       rounded-2xl bg-primary text-black font-black text-xs tracking-widest shadow-lg shadow-black/40">
            <MessageCircle className="w-4 h-4" aria-hidden />
            {fr ? 'TCHAT' : 'CHAT'}
            {nonLus > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-5 h-5 px-1 rounded-full bg-white text-black text-[10px] flex items-center justify-center">
                {nonLus > 99 ? '99+' : nonLus}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* deplie : le tiroir monte du bas ; le tableau reste visible au-dessus */}
      <AnimatePresence>
      {deplie && (
      <motion.div key="tiroir"
        initial={reduit ? false : { y: '100%' }} animate={{ y: 0 }} exit={reduit ? { opacity: 0 } : { y: '100%' }}
        transition={ressort}
        drag={reduit ? false : 'y'} dragListener={false} dragControls={tirer}
        dragConstraints={{ top: 0, bottom: 0 }} dragElastic={{ top: 0, bottom: 0.7 }}
        onDragEnd={(_, i) => { if (i.offset.y > 90 || i.velocity.y > 500) onDeplier(false); }}
        className="fixed inset-x-0 bottom-0 z-[58] mx-auto w-full max-w-xl h-[72vh] flex flex-col rounded-t-3xl
                   border border-b-0 border-white/10 bg-card/95 backdrop-blur-xl shadow-[0_-12px_40px_rgba(0,0,0,0.45)]">

        {/* la poignee : on la tire vers le bas, ou on touche la fleche */}
        <div onPointerDown={e => tirer.start(e)}
          className="shrink-0 cursor-grab active:cursor-grabbing touch-none select-none px-4 pt-2 pb-1.5 flex flex-col gap-1.5">
          <span className="self-center w-10 h-1 rounded-full bg-white/25" aria-hidden />
          <span className="flex items-center gap-2 min-w-0">
            <MessageCircle className="w-4 h-4 text-primary shrink-0" aria-hidden />
            <span className="font-black font-display text-xs tracking-widest">
              {duel ? (fr ? 'TCHAT DU DUEL' : 'DUEL CHAT') : (fr ? 'TCHAT' : 'CHAT')}
            </span>
            {!!presences && presences.n > 0 && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" aria-hidden />
                {presences.n} {fr ? 'en ligne' : 'online'}
              </span>
            )}
            <button onClick={() => onDeplier(false)} onPointerDown={e => e.stopPropagation()}
                    aria-label={fr ? 'Replier le tchat' : 'Collapse the chat'}
                    className="ml-auto p-1.5 rounded-lg hover:bg-white/10 text-foreground/70">
              <ChevronDown className="w-4 h-4" />
            </button>
          </span>
        </div>

      <div className="flex-1 min-h-0 flex flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] gap-2">

        <div className={`grid ${duel ? 'grid-cols-3' : 'grid-cols-2'} gap-1 p-1 rounded-xl bg-card/60 border border-white/5`}>
          {onglets.map(o => (
            <button key={o} onClick={() => { setOnglet(o); setErreur(null); }}
                    className={`relative py-1.5 rounded-lg text-[11px] font-black tracking-widest transition-colors
                                ${onglet === o ? 'bg-white/10 text-foreground' : 'text-foreground/60 hover:bg-white/5'}`}>
              {o === 'tous' ? (fr ? 'TOUS' : 'ALL') : o === 'prives' ? (fr ? 'PRIVÉS' : 'PRIVATE') : (fr ? 'INVITER' : 'INVITE')}
              {o === 'prives' && nonLusPrives > 0 && onglet !== 'prives' && (
                <span className="absolute top-1 right-2 w-2 h-2 rounded-full bg-primary" aria-hidden />
              )}
            </button>
          ))}
        </div>

        <CarteNotifications fr={fr} />

        {duel && t.invitations.length > 0 && !moi.inscrit && (
          <p className="text-xs px-3 py-2 rounded-xl bg-primary/15 border border-primary/40">
            {fr ? 'On t’invite : ' : 'Invited by: '}
            {t.invitations.slice(0, 5).map((i, k) => (
              <span key={i.de + k}>{k ? ', ' : ''}<b style={{ color: i.camp ? TEINTE[i.camp] : undefined }}>{i.de}</b></span>
            ))}
            {fr ? '. Choisis ton camp sur le tableau pour écrire.' : '. Pick your side on the board to write.'}
          </p>
        )}

        {onglet === 'inviter' ? (
          moi.inscrit ? <Inviter fr={fr} />
            : <p className="text-sm text-muted-foreground text-center py-8">{texteRefus('camp', undefined, fr)}</p>
        ) : (
          <>
            {onglet === 'prives' && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
                <button onClick={() => setChoix('prive')} disabled={!moi.inscrit}
                        className="shrink-0 px-3 py-1 rounded-full text-[11px] font-black bg-white text-black disabled:opacity-40">
                  + {fr ? 'NOUVEAU' : 'NEW'}
                </button>
                {conversations.map(c => (
                  <button key={c.qui} onClick={() => setAvec(c.qui)}
                          className={`shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border
                                      ${avec && avec.toLowerCase() === c.qui.toLowerCase() ? 'bg-white/15 border-white/40' : 'border-white/10'}`}>
                    {c.qui}{c.nonLu && <span className="ml-1 text-primary">•</span>}
                  </button>
                ))}
                {avec && !conversations.some(c => c.qui.toLowerCase() === avec.toLowerCase()) && (
                  <span className="shrink-0 px-3 py-1 rounded-full text-[11px] font-bold border bg-white/15 border-white/40">{avec}</span>
                )}
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto rounded-2xl bg-card/40 border border-white/5 p-1.5">
              {!t.charge && <Loader2 className="w-4 h-4 animate-spin mx-auto my-8 text-muted-foreground" />}
              {t.charge && t.refus && (
                <p className="text-sm text-muted-foreground text-center py-8 px-4">{texteRefus(t.refus, undefined, fr)}</p>
              )}
              {t.charge && !t.refus && !fil.length && (
                <p className="text-xs text-muted-foreground text-center py-8 px-4">
                  {onglet === 'tous'
                    ? (duel ? (fr ? 'Personne n’a encore parlé. Lance la bataille !' : 'Nobody has spoken yet. Start the battle!')
                            : (fr ? 'Personne n’a encore parlé. Lance la discussion !' : 'Nobody has spoken yet. Get it started!'))
                    : avec ? (fr ? `Écris à ${avec}. Seuls vous deux lirez.` : `Write to ${avec}. Only the two of you will read it.`)
                    : (fr ? 'Choisis une conversation, ou écris à un coureur du duel.' : 'Pick a conversation, or write to a runner of the duel.')}
                </p>
              )}
              <ul className="flex flex-col gap-0.5">
                {fil.map(m => <Ligne key={m.id} m={m} fr={fr} present={m.officiel ? undefined : presenceDe(m.de)} onMenu={setMenu} onAimer={t.aimer} />)}
              </ul>
              <div ref={fin} />
            </div>

            {erreur && <p className="text-xs text-red-400 text-center">{erreur}</p>}
            {!moi.inscrit && !enJeu && !t.refus && (
              <p className="text-xs text-muted-foreground text-center">{texteRefus('camp', undefined, fr)}</p>
            )}

            {peutEcrire && (
              <div className="flex flex-col gap-1.5">
                {cleJeu && onglet === 'tous' && (
                  <button onClick={() => { setVoixDuJeu(v => !v); setErreur(null); }} disabled={!moi.inscrit}
                          className={`self-start flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-black border
                                      ${voixDuJeu ? 'bg-[#5CC8FF] text-black border-[#5CC8FF]' : 'border-white/20 text-foreground/70'}`}>
                    <BadgeCheck className="w-3 h-3" aria-hidden />
                    {voixDuJeu ? (fr ? 'TU ÉCRIS EN SPRINTERGAME' : 'WRITING AS SPRINTERGAME')
                               : (fr ? 'TU ÉCRIS SOUS TON NOM' : 'WRITING AS YOURSELF')}
                  </button>
                )}
                {onglet === 'tous' && pour && !enJeu && (
                  <span className="self-start flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full bg-primary/20 border border-primary/50 text-[11px]">
                    {fr ? 'pour' : 'to'} <b>{pour}</b>
                    <button onClick={() => setPour(null)} className="p-0.5 rounded-full hover:bg-white/10"><X className="w-3 h-3" /></button>
                  </span>
                )}
                <div className="flex items-end gap-1.5">
                  {onglet === 'tous' && !enJeu && (
                    <button onClick={() => setChoix('designer')} title={fr ? 'Désigner quelqu’un' : 'Mention someone'}
                            className="p-2.5 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 shrink-0">
                      <AtSign className="w-4 h-4" />
                    </button>
                  )}
                  <div className="flex-1 relative">
                    {/* SprinterGame ecrit sans limite de longueur (17/10) */}
                    <textarea value={texte} rows={1} maxLength={enJeu ? undefined : MAX}
                              onChange={e => setTexte(enJeu ? e.target.value : e.target.value.slice(0, MAX))}
                              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } }}
                              placeholder={onglet === 'prives'
                                ? (fr ? `Message privé à ${avec}` : `Private message to ${avec}`)
                                : enJeu ? (fr ? 'Message officiel…' : 'Official message…')
                                : duel ? (fr ? 'Écris aux deux camps…' : 'Write to both sides…')
                                : (fr ? 'Écris à tout le monde…' : 'Write to everyone…')}
                              className="w-full resize-none px-3 py-2.5 pr-12 rounded-xl bg-background/70 border border-white/10 outline-none text-sm focus:border-primary/60" />
                    {!enJeu && <span className="absolute right-2.5 bottom-2.5 text-[10px] text-muted-foreground/70">{MAX - texte.length}</span>}
                  </div>
                  <button onClick={envoyer} disabled={envoi || !texte.trim()}
                          className="p-2.5 rounded-xl bg-primary text-black shrink-0 disabled:opacity-40">
                    {envoi ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground/60 text-center leading-snug">
                  {fr ? 'Pas de lien, pas de contact, pas d’insulte. Touche un nom pour répondre, écrire en privé, signaler ou bloquer. Double tap pour aimer.'
                      : 'No links, no contacts, no insults. Tap a name to reply, write privately, report or block. Double-tap to like.'}
                </p>
              </div>
            )}
          </>
        )}
      </div>
      </motion.div>
      )}
      </AnimatePresence>

      <AnimatePresence>
        {menu && (
          <MenuMessage m={menu} fr={fr} onClose={() => setMenu(null)}
            onDesigner={() => { setPour(menu.de); setOnglet('tous'); setMenu(null); }}
            onPrive={() => { setAvec(menu.de); setOnglet('prives'); setMenu(null); }}
            onBloque={() => { t.oter(menu.de); setMenu(null); }} />
        )}
        {choix && (
          <ChoixPersonne participants={t.participants} moi={cleMoi} fr={fr} presenceDe={presenceDe}
            titre={choix === 'designer' ? (fr ? 'DÉSIGNER' : 'MENTION') : (fr ? 'ÉCRIRE À' : 'WRITE TO')}
            onClose={() => setChoix(null)}
            onChoix={p => {
              if (choix === 'designer') setPour(p.name); else { setAvec(p.name); setOnglet('prives'); }
              setChoix(null);
            }} />
        )}
      </AnimatePresence>
    </>,
    document.body,
  );
}

/**
 * LE TCHAT DU JEU, sur l'accueil, une fois le duel ferme (16/10). Le meme
 * tiroir, sans camps ni invitations, ouvert a tout nom reserve. Une
 * notification du tchat touchee l'ouvre deplie, sur le dernier message qui
 * vise ce joueur. Sans nom, pas de tchat : il n'y aurait rien a lire.
 */
export function TchatDuJeu() {
  const fr = SprinterApp.N.getLang() === 'fr';
  const [deplie, setDeplie] = useState(false);
  const [vise, setVise] = useState(false);
  useEffect(() => {
    const ouvrir = (q: string | null) => { if (q) { setVise(true); setDeplie(true); } };
    ouvrir(reprendreTouchee(['marques_tchat']));
    return surCourrier(() => ouvrir(reprendreTouchee(['marques_tchat'])));
  }, []);
  const name = getSavedName() || '';
  if (!name) return null;
  return (
    <TchatMarques fr={fr} duel={false} moi={{ name, inscrit: true }}
      deplie={deplie} onDeplier={setDeplie} viserLeDernier={vise} />
  );
}
