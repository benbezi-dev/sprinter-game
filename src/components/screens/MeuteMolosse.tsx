import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { SprinterApp, SprinterI18N, useGameStore } from '@/game/engine';
import { getSavedName, saveName, fetchTopPlayers, type TopPlayer, type RaceKey } from '@/game/leaderboard';
import { canNativeShare } from '@/game/challenge';
import { NUITS, nuitDe, rangerLaNuit, etatDeLaChasse, nuitAPlusieurs } from '@/game/halloween';
import { mot, chrono } from '@/game/halloween-mots';
import { usePresences } from '@/game/presence';
import { COURSES, distanceDe } from '@/game/halloween-courses.js';
import {
  abonnerMeute, etatDeLaMeute, ouvrirLaMeute, rejoindreLaMeute, basculerPret, suisPret,
  quitterLaMeute, lienDeLaMeute, nuitDeLaMeute, inviterDansLaMeute, MEUTE_MIN, MEUTE_MAX,
  type EtatMeute, type ArriveeMeute,
} from '@/game/halloween-meute';

/* ---------------------------------------------------------------------------
   LA MEUTE — les deux ecrans de la nuit a plusieurs
   ---------------------------------------------------------------------------
   Le salon, pose par-dessus le tableau des treize nuits : on y ouvre une
   meute (une nuit deja ouverte, de deux a huit coureurs) ou l'on en rejoint
   une par son code. Et l'ecran de fin, qui remplace le chapitre : qui a tenu,
   qui a ete pris, et a combien de metres. La plomberie vit dans
   game/halloween-meute.ts ; ici, on ne fait que la montrer.
--------------------------------------------------------------------------- */

function useMeute(): EtatMeute {
  return useSyncExternalStore(abonnerMeute, etatDeLaMeute, etatDeLaMeute);
}

function trace(cle: string): string {
  const t = mot('hw_trace_' + cle);
  if (t !== 'hw_trace_' + cle) return t;
  const c = (COURSES as any)[cle];
  return c ? c.label : cle;
}

function dit(paire: [string, string]): string { return paire[SprinterI18N.index()]; }

function erreurDe(code: string, nuit: number | null): string {
  if (!code) return '';
  if (code === 'verrouillee') return mot('hw_m_err_verrouillee', { n: String(nuit || '?') });
  const cle = 'hw_m_err_' + code;
  const t = mot(cle);
  return t === cle ? mot('hw_m_err_reseau') : t;
}

const BOUTON = 'py-2.5 rounded-xl text-[11px] font-black tracking-widest uppercase active:scale-95 transition-transform disabled:opacity-40';

/** Un selecteur a deux fleches : la nuit, le nombre de coureurs. */
function Pas({ libelle, valeur, moins, plus, peutMoins, peutPlus }: {
  libelle: string; valeur: React.ReactNode;
  moins: () => void; plus: () => void; peutMoins: boolean; peutPlus: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-[9px] font-bold tracking-[0.18em] uppercase text-foreground/45">{libelle}</span>
      <button onClick={moins} disabled={!peutMoins}
              className="w-8 h-8 rounded-lg border border-white/15 text-foreground/80 font-black disabled:opacity-25">‹</button>
      <div className="flex-1 min-w-0 text-center">{valeur}</div>
      <button onClick={plus} disabled={!peutPlus}
              className="w-8 h-8 rounded-lg border border-white/15 text-foreground/80 font-black disabled:opacity-25">›</button>
    </div>
  );
}

/** Les tableaux ou l'on va chercher des adversaires : le sprint plat. */
const TABLEAUX: RaceKey[] = ['100', '200', '400'];

/**
 * CHOISIR SES ADVERSAIRES DANS LE TOP 500.
 *
 * Le tableau d'une distance, un joueur par ligne, avec une recherche : un
 * toucher l'invite (game/halloween-meute.ts, inviterDansLaMeute) — son
 * telephone sonne et lui propose la meute. On ne propose ni soi-meme, ni ceux
 * qui sont deja dans le salon, et pas plus d'invitations qu'il ne reste de
 * places. Un nom que personne n'a reserve est injoignable : on le dit.
 */
function ChoixTop500({ fermer }: { fermer: () => void }) {
  const m = useMeute();
  const [tableau, poserTableau] = useState<RaceKey>('100');
  const [liste, poserListe] = useState<TopPlayer[] | null>(null);
  const [panne, poserPanne] = useState(false);
  const [cherche, poserCherche] = useState('');
  const [message, poserMessage] = useState('');

  useEffect(() => {
    let vivant = true;
    poserListe(null); poserPanne(false);
    fetchTopPlayers(tableau)
      .then(l => { if (vivant) poserListe(l); })
      .catch(() => { if (vivant) poserPanne(true); });
    return () => { vivant = false; };
  }, [tableau]);

  const moi = (getSavedName() || '').trim().toLowerCase();
  const presents = new Set((m.salon?.joueurs || []).map(j => j.nom.trim().toLowerCase()));
  const q = cherche.trim().toLowerCase();
  const vus = new Set<string>();
  const lignes = (liste || []).filter(p => {
    const k = p.name.trim().toLowerCase();
    if (!k || k === moi || vus.has(k)) return false;
    vus.add(k);
    return !q || k.includes(q);
  });
  const max = m.salon?.max || MEUTE_MAX;
  const engages = (m.salon?.joueurs || []).length
    + Object.values(m.invites).filter(v => v !== 'injoignable').length;
  const libres = Math.max(0, max - engages);

  const inviter = async (nom: string) => {
    poserMessage('');
    const r = await inviterDansLaMeute(nom);
    if (r === 'nom') poserMessage(mot('hw_m_top_nom'));
    else if (r === 'plein') poserMessage(mot('hw_m_top_plein'));
    else if (r === 'injoignable') poserMessage(mot('hw_m_top_injoignable', { n: nom }));
  };

  return (
    <motion.div className="absolute inset-0 z-[62] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="relative w-full sm:max-w-md h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl
                      border-2 border-[#E86826]/50 bg-[#0D0814] px-4 pt-4
                      pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">{mot('hw_m_titre')} {m.code}</div>
        <h3 className="font-black font-display text-xl uppercase leading-none text-[#F8A02E]">{mot('hw_m_top_titre')}</h3>
        <p className="mt-1 text-[10px] text-foreground/55">
          {libres > 0 ? mot('hw_m_top_places', { n: String(libres) }) : mot('hw_m_top_plein')}
        </p>

        <div className="mt-3 flex gap-1.5">
          {TABLEAUX.map(t => (
            <button key={t} onClick={() => poserTableau(t)}
                    className={`flex-1 py-1.5 rounded-lg text-[10px] font-black tracking-widest border
                      ${tableau === t ? 'bg-[#E86826] text-black border-[#E86826]' : 'border-white/15 text-foreground/70'}`}>
              {t} M
            </button>
          ))}
        </div>
        <input value={cherche} onChange={e => poserCherche(e.target.value)} placeholder={mot('hw_m_top_chercher')}
               className="mt-2 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-foreground outline-none focus:border-[#E86826]" />
        {message && <p className="mt-2 text-[11px] text-destructive">{message}</p>}

        <div className="mt-2 flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
          {liste === null && !panne && <p className="text-[11px] italic text-foreground/50 py-4 text-center">{mot('hw_m_connexion')}</p>}
          {panne && <p className="text-[11px] text-destructive py-4 text-center">{mot('hw_m_err_reseau')}</p>}
          {lignes.map(p => {
            const k = p.name.trim().toLowerCase();
            const deja = presents.has(k);
            const v = Object.entries(m.invites).find(([n]) => n.trim().toLowerCase() === k)?.[1];
            return (
              <div key={k} className="rounded-lg border border-white/10 bg-[#160D22] px-2.5 py-1.5 flex items-center gap-2">
                <span className="w-9 text-right font-mono tabular-nums text-[10px] text-foreground/45">{p.rank}</span>
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground">{p.name}</span>
                <span className="font-mono tabular-nums text-[10px] text-foreground/50">{(p.ms / 1000).toFixed(2)}</span>
                {deja ? (
                  <span className="w-20 text-center text-[9px] font-black tracking-widest text-[#7CD04E]">{mot('hw_m_top_dedans')}</span>
                ) : v === 'invite' ? (
                  <span className="w-20 text-center text-[9px] font-black tracking-widest text-[#7CD04E]">{mot('hw_m_top_invite')}</span>
                ) : v === 'injoignable' ? (
                  <span className="w-20 text-center text-[9px] font-black tracking-widest text-foreground/35">{mot('hw_m_top_hors')}</span>
                ) : (
                  <button onClick={() => inviter(p.name)} disabled={v === 'envoi' || libres <= 0}
                          className="w-20 py-1 rounded-md bg-[#E86826] text-black text-[9px] font-black tracking-widest disabled:opacity-35">
                    {v === 'envoi' ? '…' : mot('hw_m_top_inviter')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={fermer}
                className="mt-3 w-full py-2.5 rounded-xl border border-white/10 text-foreground/60 text-[11px] font-bold tracking-widest uppercase">
          {mot('hw_m_top_fini')}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * CHOISIR DES JOUEURS EN LIGNE.
 *
 * Ceux qui ont le jeu ouvert AU MENU, maintenant — ceux qui repondront dans la
 * seconde (quoi === 'menu', game/presence.ts). Meme geste que le TOP 500 : un
 * toucher les invite. On ne propose ni soi-meme, ni ceux qui sont deja dans le
 * salon, et pas plus d'invitations qu'il ne reste de places. La liste se relit
 * toute seule (usePresences, toutes les 20 s) ; soi-meme en est deja retire.
 */
function ChoixEnLigne({ fermer }: { fermer: () => void }) {
  const m = useMeute();
  const presences = usePresences();
  const [cherche, poserCherche] = useState('');
  const [message, poserMessage] = useState('');

  const moi = (getSavedName() || '').trim().toLowerCase();
  const presents = new Set((m.salon?.joueurs || []).map(j => j.nom.trim().toLowerCase()));
  const q = cherche.trim().toLowerCase();
  const vus = new Set<string>();
  const lignes = (presences?.joueurs || []).filter(p => {
    if (p.quoi !== 'menu') return false; // dispo seulement
    const k = String(p.nom).trim().toLowerCase();
    if (!k || k === moi || vus.has(k)) return false;
    vus.add(k);
    return !q || k.includes(q);
  });
  const max = m.salon?.max || MEUTE_MAX;
  const engages = (m.salon?.joueurs || []).length
    + Object.values(m.invites).filter(v => v !== 'injoignable').length;
  const libres = Math.max(0, max - engages);

  const inviter = async (nom: string) => {
    poserMessage('');
    const r = await inviterDansLaMeute(nom);
    if (r === 'nom') poserMessage(mot('hw_m_top_nom'));
    else if (r === 'plein') poserMessage(mot('hw_m_top_plein'));
    else if (r === 'injoignable') poserMessage(mot('hw_m_top_injoignable', { n: nom }));
  };

  return (
    <motion.div className="absolute inset-0 z-[62] flex items-end sm:items-center justify-center bg-black/80 p-0 sm:p-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <div className="relative w-full sm:max-w-md h-[88dvh] flex flex-col rounded-t-3xl sm:rounded-3xl
                      border-2 border-[#7CD04E]/50 bg-[#0D0814] px-4 pt-4
                      pb-[max(env(safe-area-inset-bottom),1rem)]">
        <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">{mot('hw_m_titre')} {m.code}</div>
        <h3 className="font-black font-display text-xl uppercase leading-none text-[#7CD04E]">{mot('hw_m_enligne_titre')}</h3>
        <p className="mt-1 text-[10px] text-foreground/55">
          {libres > 0 ? mot('hw_m_top_places', { n: String(libres) }) : mot('hw_m_top_plein')}
        </p>

        <input value={cherche} onChange={e => poserCherche(e.target.value)} placeholder={mot('hw_m_top_chercher')}
               className="mt-3 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-foreground outline-none focus:border-[#7CD04E]" />
        {message && <p className="mt-2 text-[11px] text-destructive">{message}</p>}

        <div className="mt-2 flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
          {presences === null && <p className="text-[11px] italic text-foreground/50 py-4 text-center">{mot('hw_m_connexion')}</p>}
          {presences !== null && !lignes.length && <p className="text-[11px] italic text-foreground/50 py-4 text-center">{mot('hw_m_enligne_vide')}</p>}
          {lignes.map(p => {
            const k = String(p.nom).trim().toLowerCase();
            const deja = presents.has(k);
            const v = Object.entries(m.invites).find(([n]) => n.trim().toLowerCase() === k)?.[1];
            return (
              <div key={k} className="rounded-lg border border-white/10 bg-[#160D22] px-2.5 py-1.5 flex items-center gap-2">
                <span className="relative inline-flex w-2 h-2 shrink-0" aria-hidden>
                  <span className="absolute inset-0 rounded-full bg-emerald-400 opacity-60 animate-ping motion-reduce:hidden" />
                  <span className="relative inline-flex w-2 h-2 rounded-full bg-emerald-400" />
                </span>
                <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground">{p.nom}</span>
                {deja ? (
                  <span className="w-20 text-center text-[9px] font-black tracking-widest text-[#7CD04E]">{mot('hw_m_top_dedans')}</span>
                ) : v === 'invite' ? (
                  <span className="w-20 text-center text-[9px] font-black tracking-widest text-[#7CD04E]">{mot('hw_m_top_invite')}</span>
                ) : v === 'injoignable' ? (
                  <span className="w-20 text-center text-[9px] font-black tracking-widest text-foreground/35">{mot('hw_m_top_hors')}</span>
                ) : (
                  <button onClick={() => inviter(p.nom)} disabled={v === 'envoi' || libres <= 0}
                          className="w-20 py-1 rounded-md bg-[#E86826] text-black text-[9px] font-black tracking-widest disabled:opacity-35">
                    {v === 'envoi' ? '…' : mot('hw_m_top_inviter')}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <button onClick={fermer}
                className="mt-3 w-full py-2.5 rounded-xl border border-white/10 text-foreground/60 text-[11px] font-bold tracking-widest uppercase">
          {mot('hw_m_top_fini')}
        </button>
      </div>
    </motion.div>
  );
}

/**
 * LE SALON DE LA MEUTE.
 *
 * @param ouvertes la nuit la plus haute qu'on peut courir : on n'ouvre une
 *   meute que sur une nuit qu'on a soi-meme ouverte (le calendrier, et la
 *   victoire de la veille). Ceux qui rejoignent courent celle de l'hote.
 * @param codeInitial un lien `?meute=` vient d'etre ouvert : on le rejoint.
 */
export function SalonDeLaMeute({ ouvertes, fermer, codeInitial = '' }: {
  ouvertes: number; fermer: () => void; codeInitial?: string;
}) {
  const m = useMeute();
  const [n, poserN] = useState(Math.max(1, Math.min(ouvertes, NUITS.length)));
  const [places, poserPlaces] = useState(4);
  const [saisie, poserSaisie] = useState(codeInitial);
  const [nom, poserNom] = useState(getSavedName());
  const [besoinNom, poserBesoinNom] = useState(false);
  const [copie, poserCopie] = useState(false);
  const [top, poserTop] = useState(false);
  const [enLigne, poserEnLigne] = useState(false);

  const avecUnNom = (suite: () => void) => {
    const v = nom.trim();
    if (!v) { poserBesoinNom(true); return; }
    poserBesoinNom(false);
    if (v !== getSavedName()) saveName(v);
    suite();
  };

  // Un lien ouvert a l'instant : on rejoint d'un coup, si le nom est connu.
  useEffect(() => {
    if (codeInitial && getSavedName()) void rejoindreLaMeute(codeInitial, ouvertes);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const partir = () => { quitterLaMeute(); fermer(); };

  const enSalon = m.etape === 'salon' || m.etape === 'course' || m.etape === 'fini';
  const nuitSalle = nuitDeLaMeute();
  const nuit = nuitSalle ? nuitDe(nuitSalle) : null;
  const joueurs = m.salon?.joueurs || [];
  const max = m.salon?.max || places;
  const pret = suisPret();

  const copier = async () => {
    try { await navigator.clipboard.writeText(lienDeLaMeute(m.code)); poserCopie(true); setTimeout(() => poserCopie(false), 1600); }
    catch { /* presse-papiers refuse */ }
  };
  const partager = async () => {
    try {
      await (navigator as any).share({
        title: 'Sprinter', text: mot('hw_m_invitation', { code: m.code }), url: lienDeLaMeute(m.code),
      });
    } catch { /* annule */ }
  };

  return (
    <motion.div className="absolute inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-6"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 26 }}
                  className="relative w-full sm:max-w-md max-h-[88dvh] overflow-y-auto rounded-t-3xl sm:rounded-3xl
                             border-2 border-[#E86826]/50 bg-[#0D0814] px-5 pt-5
                             pb-[max(env(safe-area-inset-bottom),1.25rem)]">
        <div className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">{mot('hw_titre')}</div>
        <h2 className="font-black font-display text-2xl uppercase leading-none text-[#F8A02E]"
            style={{ textShadow: '0 0 14px rgba(255,90,20,0.55)' }}>
          {enSalon ? mot('hw_m_salon', { code: m.code }) : mot('hw_m_titre')}
        </h2>
        <p className="mt-1 text-[11px] leading-snug text-foreground/60">{mot('hw_m_sous')}</p>

        {!enSalon && (<>
          <p className="mt-3 rounded-xl border border-[#E86826]/25 bg-[#160D22] px-3 py-2 text-[11px] leading-snug text-foreground/75">
            {mot('hw_m_regle')}
          </p>

          <label className="mt-4 block">
            <span className={`text-[9px] font-bold tracking-[0.18em] uppercase ${besoinNom ? 'text-destructive' : 'text-foreground/45'}`}>
              {besoinNom ? mot('hw_m_nom_requis') : mot('hw_m_nom')}
            </span>
            <input value={nom} maxLength={20} onChange={e => poserNom(e.target.value)}
                   className="mt-1 w-full rounded-lg bg-black/40 border border-white/15 px-3 py-2 text-sm text-foreground outline-none focus:border-[#E86826]" />
          </label>

          <div className="mt-4 text-[9px] font-bold tracking-[0.2em] uppercase text-[#E86826] mb-2">{mot('hw_m_ouvrir')}</div>
          <div className="flex flex-col gap-2">
            <Pas libelle={mot('hw_m_nuit')}
                 moins={() => poserN(x => Math.max(1, x - 1))} plus={() => poserN(x => Math.min(ouvertes, x + 1))}
                 peutMoins={n > 1} peutPlus={n < ouvertes}
                 valeur={<span className="flex flex-col leading-tight">
                   <span className="font-bold text-xs text-foreground truncate">{mot('hw_nuit_n', { n: String(n) })} · {dit(nuitDe(n).nom)}</span>
                   <span className="text-[10px] font-mono text-foreground/55">
                     {trace(nuitDe(n).epreuve)} · {mot('hw_imparti', { s: chrono(nuitDe(n).imparti) })}
                   </span>
                 </span>} />
            <Pas libelle={mot('hw_m_places')}
                 moins={() => poserPlaces(x => Math.max(MEUTE_MIN, x - 1))} plus={() => poserPlaces(x => Math.min(MEUTE_MAX, x + 1))}
                 peutMoins={places > MEUTE_MIN} peutPlus={places < MEUTE_MAX}
                 valeur={<span className="font-black font-display text-xl text-[#F8A02E]">{places}</span>} />
            <button disabled={m.etape === 'connexion'} onClick={() => avecUnNom(() => { void ouvrirLaMeute(n, places, ouvertes); })}
                    className={`${BOUTON} bg-[#E86826] text-black`}>
              {mot('hw_m_creer')}
            </button>
          </div>

          <div className="mt-4 text-[9px] font-bold tracking-[0.2em] uppercase text-[#E86826] mb-2">{mot('hw_m_rejoindre')}</div>
          <div className="flex gap-2">
            <input value={saisie} placeholder={mot('hw_m_code')} maxLength={10}
                   onChange={e => poserSaisie(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                   className="flex-1 min-w-0 rounded-lg bg-black/40 border border-white/15 px-3 py-2 font-mono tracking-[0.3em] text-sm text-foreground outline-none focus:border-[#E86826]" />
            <button disabled={saisie.length < 4 || m.etape === 'connexion'}
                    onClick={() => avecUnNom(() => { void rejoindreLaMeute(saisie, ouvertes); })}
                    className={`${BOUTON} px-4 border border-[#E86826]/60 text-[#F8A02E]`}>
              {mot('hw_m_rejoindre')}
            </button>
          </div>

          {m.etape === 'connexion' && (
            <p className="mt-3 text-[11px] text-foreground/60 italic">{mot('hw_m_connexion')}</p>
          )}
        </>)}

        {enSalon && (<>
          {nuit && (
            <div className="mt-3 rounded-xl border border-[#E86826]/35 bg-[#160D22] px-3 py-2">
              <div className="font-bold text-xs text-foreground">{mot('hw_nuit_n', { n: String(nuit.n) })} · {dit(nuit.nom)}</div>
              <div className="text-[10px] font-mono text-foreground/55">
                {trace(nuit.epreuve)} · {mot('hw_imparti', { s: chrono(nuit.imparti) })} · {mot('hw_dep_blocs')}
              </div>
            </div>
          )}

          <div className="mt-3 text-[9px] font-bold tracking-[0.2em] uppercase text-foreground/45 mb-1.5">{mot('hw_m_inviter')}</div>
          <div className="flex gap-2">
            <div className="flex-1 rounded-lg border border-[#F8A02E]/40 bg-black/40 py-2 text-center font-mono font-black tracking-[0.35em] text-lg text-[#F8A02E]">
              {m.code}
            </div>
            <button onClick={copier} className={`${BOUTON} px-3 border border-white/15 text-foreground/80`}>
              {copie ? mot('hw_m_copie') : mot('hw_m_copier')}
            </button>
            {canNativeShare() && (
              <button onClick={partager} className={`${BOUTON} px-3 border border-white/15 text-foreground/80`}>
                {mot('hw_m_partager')}
              </button>
            )}
          </div>

          {/* LE TOP 500 : choisir ses adversaires parmi les meilleurs du jeu.
              Leur telephone sonne ; ils rejoignent d'un toucher. */}
          {joueurs.length < max && (
            <button onClick={() => poserTop(true)}
                    className={`mt-2 w-full ${BOUTON} border border-[#E86826]/60 text-[#F8A02E]`}>
              {mot('hw_m_top_ouvrir')}
            </button>
          )}
          {/* LES JOUEURS EN LIGNE : ceux qui ont le jeu ouvert au menu,
              maintenant. Eux repondront tout de suite. */}
          {joueurs.length < max && (
            <button onClick={() => poserEnLigne(true)}
                    className={`mt-2 w-full ${BOUTON} border border-[#7CD04E]/50 text-[#7CD04E]`}>
              {mot('hw_m_enligne_ouvrir')}
            </button>
          )}

          <div className="mt-4 flex flex-col gap-1.5">
            {Array.from({ length: max }, (_, i) => {
              const j = joueurs[i];
              // Les invites du TOP 500 qu'on attend, dans les places libres.
              const attendus = Object.entries(m.invites)
                .filter(([n, v]) => v === 'invite' && !joueurs.some(x => x.nom.trim().toLowerCase() === n.trim().toLowerCase()))
                .map(([n]) => n);
              const attendu = !j ? attendus[i - joueurs.length] : undefined;
              if (!j && attendu) return (
                <div key={'a' + i} className="rounded-xl border border-dashed border-[#E86826]/40 px-3 py-2 flex items-center gap-2 text-[11px]">
                  <span className="w-5 text-center font-black font-display text-[#F8A02E]/50">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-foreground/70">{attendu}</span>
                  <span className="text-[10px] font-black tracking-widest text-[#F8A02E]/70">{mot('hw_m_top_invite')}</span>
                </div>
              );
              if (!j) return (
                <div key={'v' + i} className="rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-foreground/30 italic">
                  {i + 1} · {mot('hw_m_place_vide')}
                </div>
              );
              const moi = j.id === m.moi;
              return (
                <div key={j.id} className={`rounded-xl border px-3 py-2 flex items-center gap-2
                                            ${moi ? 'border-[#F8A02E]/50 bg-[#22101C]' : 'border-[#E86826]/25 bg-[#160D22]'}`}>
                  <span className="w-5 text-center font-black font-display text-[#F8A02E]">{i + 1}</span>
                  <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground">
                    {j.nom}{moi && <span className="ml-1.5 text-[10px] font-normal text-foreground/50">({mot('hw_m_toi')})</span>}
                    {j.hote && <span className="ml-1.5 text-[10px] font-normal text-[#7CD04E]">{mot('hw_m_hote')}</span>}
                  </span>
                  <span className={`text-[10px] font-black tracking-widest ${j.pret ? 'text-[#7CD04E]' : 'text-foreground/35'}`}>
                    {j.pret ? mot('hw_m_est_pret') : mot('hw_m_attend')}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-foreground/50 text-center">{mot('hw_m_attente', { n: String(max) })}</p>

          <button onClick={basculerPret}
                  className={`mt-3 w-full ${BOUTON} ${pret ? 'border border-[#7CD04E]/60 text-[#7CD04E]' : 'bg-[#E86826] text-black'}`}>
            {pret ? mot('hw_m_plus_pret') : mot('hw_m_pret')}
          </button>
        </>)}

        {m.erreur && (
          <p className="mt-3 text-[11px] text-destructive">{erreurDe(m.erreur, m.nuitRefusee)}</p>
        )}

        <button onClick={partir}
                className="w-full mt-3 py-2.5 rounded-xl border border-white/10 text-foreground/60 text-[11px] font-bold tracking-widest uppercase">
          {enSalon ? mot('hw_m_quitter') : mot('hw_fermer')}
        </button>
      </motion.div>
      {top && enSalon && <ChoixTop500 fermer={() => poserTop(false)} />}
      {enLigne && enSalon && <ChoixEnLigne fermer={() => poserEnLigne(false)} />}
    </motion.div>
  );
}

/**
 * LE MORDU REGARDE LA MEUTE (consigne du 18/10). La bete l'a pris, il reste
 * sur la piste : le bandeau le lui dit, et nomme celui qu'elle chasse
 * maintenant — la camera le suit (halloween.ts, poursuivreLaMeute).
 */
export function BandeauDeLaMeute() {
  const state = useGameStore(s => s.state);
  const spectateur = useGameStore(() => !!SprinterApp.G.spectateur);
  const proie = useGameStore(() => (SprinterApp.G.suivi && SprinterApp.G.suivi.name) || '');
  const m = useMeute();
  if (state !== 'race' || !spectateur || !nuitAPlusieurs()) return null;
  return (
    <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
      className="absolute top-[calc(max(env(safe-area-inset-top),0.75rem)+2.25rem)] left-0 right-0 z-30
                 flex flex-col items-center gap-1.5 px-4 pointer-events-none">
      <div className="px-3 py-1 rounded-full text-[10px] font-black tracking-[0.25em] uppercase bg-destructive text-white">
        {mot('hw_m_pris')}
      </div>
      {proie && !m.resultat && (
        <div className="px-3 py-0.5 rounded-full text-[10px] font-bold tracking-[0.2em] uppercase
                        bg-black/60 text-[#F8A02E] border border-[#E86826]/40">
          {mot('hw_m_chasse', { n: proie })}
        </div>
      )}
    </motion.div>
  );
}

/** Une ligne de l'ecran de fin : ce que la nuit a fait de ce coureur. */
type Ligne = {
  id: string; nom: string; moi: boolean;
  place: number | null;
  ms: number | null; mordu: number | null; abandon: boolean;
  enCourse: number | null;
};

/** L'ordre de la meute : les survivants au chrono, puis les mordus au plus loin. */
function rang(l: Ligne): number {
  if (l.ms != null) return l.ms;
  if (l.mordu != null) return 1e7 - l.mordu;
  if (l.abandon) return 2e7;
  return -1e7 - (l.enCourse || 0);   // encore en course : en tete, on l'attend
}

/**
 * L'ECRAN DE FIN DE LA MEUTE, a la place du chapitre.
 *
 * Il se monte des que SA nuit est finie — passee ou mordu — et suit les
 * autres pendant qu'ils courent encore. Le verdict de la salle fixe les
 * places quand le dernier est arrive. La revanche se demande ensuite a tout
 * le monde ; elle part quand tous l'ont dite, depuis cet ecran.
 */
export function FinDeLaMeute() {
  const state = useGameStore(s => s.state);
  const joueur = useGameStore(s => s.player);
  const m = useMeute();
  const [, battre] = useState(0);
  // Les distances de ceux qui courent encore ne passent pas par l'etat :
  // un battement suffit a les relire.
  useEffect(() => {
    if (m.resultat) return;
    const id = setInterval(() => battre(x => x + 1), 300);
    return () => clearInterval(id);
  }, [m.resultat]);

  if (state !== 'winall') return null;

  const c = etatDeLaChasse();
  const passe = !!c && c.verdict === 'passe';
  const nuit = c ? c.nuit : null;
  const total = nuit ? distanceDe(nuit.epreuve) : 100;

  // Qui court cette nuit : le salon, plus ceux du verdict qui seraient partis.
  const parId = new Map<string, Ligne>();
  for (const j of m.salon?.joueurs || []) {
    parId.set(j.id, {
      id: j.id, nom: j.nom, moi: j.id === m.moi, place: null,
      ms: null, mordu: null, abandon: false, enCourse: m.positions[j.id] ?? 0,
    });
  }
  // Soi : ce que la nuit en a fait, sans attendre la salle.
  if (m.moi) {
    const l = parId.get(m.moi) || {
      id: m.moi, nom: getSavedName(), moi: true, place: null,
      ms: null, mordu: null, abandon: false, enCourse: 0,
    };
    if (passe && c) l.ms = c.chrono * 1000;
    else if (c && c.verdict === 'mordu') l.mordu = joueur ? Math.max(0, joueur.d) : 0;
    else l.abandon = true;
    l.enCourse = null;
    parId.set(m.moi, l);
  }
  const arrivees: ArriveeMeute[] = Object.values(m.arrivees);
  for (const a of arrivees) {
    if (a.id === m.moi) continue;
    const l = parId.get(a.id) || {
      id: a.id, nom: a.nom, moi: false, place: null, ms: null, mordu: null, abandon: false, enCourse: null,
    };
    l.ms = a.ms; l.mordu = a.mordu; l.abandon = a.abandon; l.enCourse = null;
    parId.set(a.id, l);
  }
  if (m.resultat) {
    for (const a of m.resultat.classement) {
      const l = parId.get(a.id) || {
        id: a.id, nom: a.nom, moi: a.id === m.moi, place: null, ms: null, mordu: null, abandon: false, enCourse: null,
      };
      l.place = a.place;
      l.ms = a.abandon ? null : a.ms;
      l.mordu = a.mordu ?? null;
      l.abandon = !!a.abandon && a.mordu == null;
      l.enCourse = null;
      parId.set(a.id, l);
    }
  }
  const lignes = [...parId.values()].sort((a, b) =>
    a.place != null && b.place != null ? a.place - b.place : rang(a) - rang(b));
  const survivants = lignes.filter(l => l.ms != null).length;
  const prets = (m.salon?.joueurs || []).filter(j => j.pret).length;
  const partants = (m.salon?.joueurs || []).length || lignes.length;
  // « Pret » ne vaut que pour la revanche, donc apres le verdict : avant lui,
  // la salle garde encore celui qui a fait partir CETTE nuit.
  const pret = !!m.resultat && suisPret();

  const sortir = () => { quitterLaMeute(); rangerLaNuit(); (SprinterApp as any).goHome(); };

  return (
    <div className="absolute inset-0 z-30 pointer-events-auto bg-[#0B0710] flex flex-col">
      <div className="absolute inset-0 pointer-events-none"
           style={{ background: 'radial-gradient(120% 70% at 50% 0%, rgba(140,10,0,0.35) 0%, rgba(0,0,0,0) 60%)' }} />
      <div className="relative px-5 pt-[max(env(safe-area-inset-top),2.5rem)] flex flex-col items-center gap-0.5">
        <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-[#7CD04E]">
          {mot('hw_m_titre')}{nuit ? ` · ${mot('hw_nuit_n', { n: String(nuit.n) })}` : ''}
        </span>
        <span className={`font-black font-display text-2xl sm:text-3xl uppercase tracking-tight
                          ${passe ? 'text-[#7CD04E]' : 'text-destructive'}`}>
          {passe ? mot('hw_m_survit') : mot('hw_mordu')}
        </span>
        <span className="font-mono tabular-nums text-sm text-foreground/80">
          {passe && c
            ? mot('hw_chrono', { s: chrono(c.chrono) })
            : mot('hw_m_mordu_a', { m: (joueur ? Math.max(0, joueur.d) : 0).toFixed(0) })}
        </span>
        <span className="mt-1 text-[11px] text-foreground/55">
          {m.resultat
            ? (survivants > 0 ? mot('hw_m_survivants', { n: String(survivants), t: String(lignes.length) }) : mot('hw_m_personne'))
            : mot('hw_m_attendre')}
        </span>
      </div>

      <div className="relative flex-1 min-h-0 overflow-y-auto px-4 mt-4 flex flex-col gap-1.5 sm:max-w-md sm:mx-auto sm:w-full">
        <AnimatePresence initial={false}>
          {lignes.map((l, i) => (
            <motion.div key={l.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        className={`rounded-xl border px-3 py-2 flex items-center gap-2
                          ${l.moi ? 'border-[#F8A02E]/50 bg-[#22101C]' : 'border-white/10 bg-[#160D22]'}`}>
              <span className="w-6 text-center font-black font-display text-lg text-[#F8A02E]">
                {l.place ?? (l.enCourse != null ? '…' : i + 1)}
              </span>
              <span className="flex-1 min-w-0 truncate text-xs font-bold text-foreground">
                {l.nom}{l.moi && <span className="ml-1.5 text-[10px] font-normal text-foreground/50">({mot('hw_m_toi')})</span>}
              </span>
              <span className={`font-mono tabular-nums text-[11px]
                ${l.ms != null ? 'text-[#7CD04E]' : l.enCourse != null ? 'text-foreground/60' : 'text-destructive'}`}>
                {l.ms != null ? chrono(l.ms / 1000)
                  : l.mordu != null ? mot('hw_m_mordu_a', { m: l.mordu.toFixed(0) })
                  : l.abandon ? mot('hw_m_faux')
                  : mot('hw_m_en_course', { m: Math.min(total, l.enCourse || 0).toFixed(0) })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
        {m.erreur === 'fermee' && (
          <p className="mt-2 text-[11px] text-destructive text-center">{mot('hw_m_err_fermee')}</p>
        )}
      </div>

      <div className="relative px-4 pt-3 pb-[max(env(safe-area-inset-bottom),1rem)] flex gap-2 sm:max-w-md sm:mx-auto sm:w-full">
        <button onClick={sortir}
                className="flex-1 py-3 rounded-xl border border-white/15 bg-black/50 text-foreground/70 text-[11px] font-black tracking-widest uppercase">
          {mot('hw_sortir')}
        </button>
        <button onClick={basculerPret} disabled={!m.resultat}
                className={`flex-[2] py-3 rounded-xl text-[11px] font-black tracking-widest uppercase active:scale-95 transition-transform disabled:opacity-40
                  ${pret ? 'border border-[#7CD04E]/60 text-[#7CD04E]' : 'bg-[#E86826] text-black'}`}>
          {pret ? mot('hw_m_revanche_ok', { n: String(prets), t: String(partants) }) : mot('hw_m_revanche')}
        </button>
      </div>
    </div>
  );
}
