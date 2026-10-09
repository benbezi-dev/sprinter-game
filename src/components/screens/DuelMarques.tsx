import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Swords, Check } from 'lucide-react';
import { MONTEE, VOILE, PANNEAU } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  CAMPS, EPREUVES, NOM_CAMP, fetchMarques, choisirCamp, monInscription, ecouterMarques, manque,
  secondes, somme, type Camp, type Epreuve, type TableauMarques, type ChoixRefuse, type Inscription,
} from '@/game/marques';
import { useRetour } from '@/hooks/use-retour';

/* ---------------------------------------------------------------------------
   LE DUEL DES MARQUES — Team adidas contre Team Nike (09/10/2026).

   La banniere de l'accueil, puis l'ecran : choisir son camp et son epreuve
   (une fois), voir le score epreuve par epreuve et les coureurs qui comptent.
   Les regles sont dans worker/src/marques.js.

   LE 200 ET LE 400 M SONT MIS EN AVANT (voulu par l'auteur) : le 100 m attire
   le plus de monde, mais une place s'y gagne au chrono ; au 200 et au 400 m,
   un camp en retard d'effectif ouvre une place au premier qui vient. L'ecran
   le dit, epreuve par epreuve, au moment du choix et sous le score.

   AUCUN LOGO ET AUCUNE COULEUR DE MARQUE : un camp en blanc, l'autre dans le
   jaune du jeu. Et la mention de non-affiliation, sur l'ecran de choix puis
   sous le tableau — Sprinter n'est lie ni a adidas ni a Nike.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const TEINTE: Record<Camp, string> = { adidas: '#FFFFFF', nike: '#FFD426' };
const NOM_EPREUVE: Record<Epreuve, string> = { '100': '100 m', '200': '200 m', '400': '400 m' };

function useFr() {
  const { N } = SprinterApp;
  return N.getLang() === 'fr';
}

/** Le tableau, relu a l'ouverture et apres chaque course envoyee. */
function useTableau() {
  const [t, setT] = useState<TableauMarques | null>(null);
  const [erreur, setErreur] = useState(false);
  const relire = useCallback(() => {
    fetchMarques().then(x => { setT(x); setErreur(false); }).catch(() => setErreur(true));
  }, []);
  useEffect(() => { relire(); return ecouterMarques(relire); }, [relire]);
  return { t, erreur };
}

const MENTION_FR = 'Sprinter n’est ni affilié à adidas ni à Nike, ni soutenu par eux. Les deux noms désignent seulement les équipes que les joueurs choisissent.';
const MENTION_EN = 'Sprinter is not affiliated with, or endorsed by, adidas or Nike. The two names only label the teams players choose.';

const Mention = ({ fr }: { fr: boolean }) => (
  <p className="w-full text-[9px] text-muted-foreground/60 text-center leading-snug px-4">{fr ? MENTION_FR : MENTION_EN}</p>
);

/* ---------------------------------------------------------------- l'accueil */

export function BanderoleMarques() {
  const fr = useFr();
  const [ouvert, setOuvert] = useState(false);
  const [ins, setIns] = useState<Inscription | null>(monInscription());
  useEffect(() => ecouterMarques(() => setIns(monInscription())), []);
  return (
    <motion.div {...MONTEE}>
      <button onClick={() => setOuvert(true)}
              className="w-full rounded-2xl border-2 border-primary/60 overflow-hidden flex items-center gap-3
                         px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.10), rgba(255,212,38,0.14))' }}>
        <Swords className="w-7 h-7 text-primary shrink-0" aria-hidden />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-white/90">
            {fr ? 'Le duel de la semaine · 100 · 200 · 400 m' : 'Duel of the week · 100 · 200 · 400 m'}
          </span>
          <span className="font-black text-sm md:text-base leading-tight">
            <span style={{ color: TEINTE.adidas }}>TEAM ADIDAS</span>
            <span className="text-foreground/60"> vs </span>
            <span style={{ color: TEINTE.nike }}>TEAM NIKE</span>
          </span>
          <span className="text-[10px] md:text-xs text-foreground/65 leading-snug">
            {ins
              ? (fr ? `Tu cours le ${NOM_EPREUVE[ins.epreuve]} pour Team ${NOM_CAMP[ins.camp]}`
                    : `You run the ${NOM_EPREUVE[ins.epreuve]} for Team ${NOM_CAMP[ins.camp]}`)
              : (fr ? 'Choisis ton camp et ton épreuve' : 'Pick your side and your event')}
          </span>
        </span>
        <span className="shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest bg-white">
          {ins ? (fr ? 'TABLEAU' : 'BOARD') : (fr ? 'CHOISIR' : 'PICK')}
        </span>
      </button>
      <AnimatePresence>
        {ouvert && <EcranMarques onClose={() => setOuvert(false)} />}
      </AnimatePresence>
    </motion.div>
  );
}

/* ---------------------------------------------------------------- l'ecran */

export function EcranMarques({ onClose }: { onClose: () => void }) {
  useRetour(onClose);
  const fr = useFr();
  const { t, erreur } = useTableau();
  const moi = t?.moi || null;
  const [vueCamp, setVueCamp] = useState<Camp | null>(null);
  const [vueEpreuve, setVueEpreuve] = useState<Epreuve | null>(null);
  const camp: Camp = vueCamp || moi?.camp || 'adidas';
  const epreuve: Epreuve = vueEpreuve || moi?.epreuve || '100';

  const courir = (e: Epreuve) => {
    onClose();
    (SprinterApp as any).startOneShot([e], { levelIdx: 4 });
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 pt-10 pb-6 flex flex-col items-center gap-4">

        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 className="font-black font-display tracking-tight text-xl md:text-2xl leading-tight">
              <span style={{ color: TEINTE.adidas }}>TEAM ADIDAS</span>
              <span className="text-foreground/50"> vs </span>
              <span style={{ color: TEINTE.nike }}>TEAM NIKE</span>
            </h2>
            <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
              {fr ? '100, 200 et 400 m · une semaine · 32 places par équipe' : '100, 200 and 400 m · one week · 32 seats per team'}
              {t?.fin ? ` · ${fr ? 'fin le' : 'ends'} ${new Date(t.fin).toLocaleString(fr ? 'fr-FR' : 'en-GB',
                { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}
            </span>
          </div>
          <button onClick={onClose}
                  className="p-2 rounded-xl bg-card/80 border border-white/10 hover:bg-white/10 transition-colors shrink-0">
            <img src={`${BASE}/icons/cross.png`} alt="" className="w-4 h-4 opacity-80" />
          </button>
        </div>

        {!t && !erreur && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground py-8">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
          </p>
        )}
        {erreur && !t && (
          <p className="text-sm text-muted-foreground py-8 text-center">
            {fr ? 'Le tableau ne répond pas. Réessaie dans un instant.' : 'The board is not answering. Try again in a moment.'}
          </p>
        )}

        {t && <Score t={t} fr={fr} />}

        <p className="w-full text-[10px] md:text-[11px] text-muted-foreground/85 text-center leading-snug px-2">
          {fr
            ? 'Tu choisis ton camp et ton épreuve. Ton meilleur chrono de la semaine compte. Sur chaque épreuve, les deux camps comptent autant de coureurs : s’il y a 14 Nike au 400 m, les 14 meilleurs adidas du 400 m comptent aussi. La plus petite somme gagne.'
            : 'Pick your side and your event. Your best time of the week counts. On each event both sides count the same number of runners: 14 Nike at 400 m means the 14 best adidas at 400 m count too. The lowest sum wins.'}
        </p>

        {t && !moi && <ChoixDuCamp t={t} fr={fr} />}

        {t && moi && <MaLigne t={t} fr={fr} courir={courir} />}

        {t && (
          <>
            <div className="w-full grid grid-cols-2 gap-1 p-1 rounded-xl bg-card/60 border border-white/5">
              {CAMPS.map(c => (
                <button key={c} onClick={() => setVueCamp(c)}
                        className={`py-1.5 rounded-lg text-[11px] font-black tracking-widest transition-colors
                                    ${camp === c ? 'bg-white/10' : 'hover:bg-white/5 text-foreground/60'}`}
                        style={camp === c ? { color: TEINTE[c] } : undefined}>
                  TEAM {NOM_CAMP[c].toUpperCase()}
                </button>
              ))}
            </div>
            <div className="w-full grid grid-cols-3 gap-1 -mt-2">
              {EPREUVES.map(e => (
                <button key={e} onClick={() => setVueEpreuve(e)}
                        className={`py-1 rounded-lg text-[11px] font-black tracking-widest transition-colors
                                    ${epreuve === e ? 'bg-white/10 text-foreground' : 'text-foreground/50 hover:bg-white/5'}`}>
                  {NOM_EPREUVE[e]}
                </button>
              ))}
            </div>
            <Coureurs t={t} camp={camp} epreuve={epreuve} fr={fr} />
          </>
        )}

        {t && moi && <Mention fr={fr} />}
      </div>
    </motion.div>
  );
}

/** Les deux totaux face a face, puis epreuve par epreuve. */
function Score({ t, fr }: { t: TableauMarques; fr: boolean }) {
  const [a, b] = CAMPS;
  const ecart = Math.abs(t.totaux[a] - t.totaux[b]);
  return (
    <div className="w-full flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {CAMPS.map(c => {
          const devant = t.tete === c;
          return (
            <div key={c} className={`rounded-xl border px-3 py-3 flex flex-col items-center gap-0.5
                                     ${devant ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-card/60'}`}>
              <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: TEINTE[c] }}>
                TEAM {NOM_CAMP[c].toUpperCase()}
              </span>
              <span className="font-black tabular-nums text-base md:text-lg">{somme(t.totaux[c], fr)}</span>
              <span className="text-[10px] text-muted-foreground/80">
                {fr ? `${t.inscrits[c]} inscrit${t.inscrits[c] > 1 ? 's' : ''}` : `${t.inscrits[c]} signed up`}
              </span>
              {devant && ecart > 0 && (
                <span className="mt-1 text-[10px] font-black tracking-widest text-primary">
                  {fr ? `EN TÊTE · ${secondes(ecart)} s` : `LEADING · ${secondes(ecart)} s`}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="rounded-xl border border-white/10 bg-card/40 divide-y divide-white/5">
        {EPREUVES.map(e => {
          const k = t.epreuves[e];
          const [ca, cb] = CAMPS.map(c => k.camps[c]);
          const attente = CAMPS.find(c => manque(t, c, e) > 0);
          return (
            <div key={e} className="px-3 py-2 flex flex-col gap-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-black tracking-widest w-14">{NOM_EPREUVE[e]}</span>
                <span className="text-[10px] text-muted-foreground">
                  {k.places
                    ? (fr ? `${k.places} contre ${k.places}` : `${k.places} vs ${k.places}`)
                    : (fr ? 'aucune place encore' : 'no seat yet')}
                </span>
                <span className="flex gap-2 tabular-nums text-[11px] font-black">
                  <span style={{ color: TEINTE[a] }}>{k.places ? somme(ca.somme_ms, fr) : '—'}</span>
                  <span style={{ color: TEINTE[b] }}>{k.places ? somme(cb.somme_ms, fr) : '—'}</span>
                </span>
              </div>
              {attente && (
                <span className="text-[10px] text-primary/90 leading-snug">
                  {fr
                    ? `${manque(t, attente, e)} place${manque(t, attente, e) > 1 ? 's' : ''} à prendre pour Team ${NOM_CAMP[attente]} : le prochain qui court le ${NOM_EPREUVE[e]} compte.`
                    : `${manque(t, attente, e)} seat${manque(t, attente, e) > 1 ? 's' : ''} open for Team ${NOM_CAMP[attente]}: the next ${NOM_EPREUVE[e]} runner counts.`}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Ma ligne : mon camp, mon epreuve, ma place, et le bouton pour courir. */
function MaLigne({ t, fr, courir }: { t: TableauMarques; fr: boolean; courir: (e: Epreuve) => void }) {
  const moi = t.moi!;
  const ep = NOM_EPREUVE[moi.epreuve];
  const etat = moi.best_ms == null
    ? (fr ? `Aucun ${ep} encore cette semaine` : `No ${ep} yet this week`)
    : moi.selectionne
      ? (fr ? `${moi.rang}ᵉ du camp au ${ep} · tu comptes` : `#${moi.rang} on your side at ${ep} · you count`)
      : moi.attend_adversaire
        ? (fr ? `${moi.rang}ᵉ · tu compteras dès qu’un adversaire de plus court le ${ep}`
              : `#${moi.rang} · you count as soon as one more rival runs the ${ep}`)
        : (fr ? `${moi.rang}ᵉ · il faut ${secondes(moi.seuil_ms ?? 0)} pour compter`
              : `#${moi.rang} · ${secondes(moi.seuil_ms ?? 0)} to count`);
  return (
    <div className="w-full rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
         style={{ borderColor: `${TEINTE[moi.camp]}66`, background: `${TEINTE[moi.camp]}14` }}>
      <div className="flex flex-col min-w-0 leading-tight">
        <span className="text-[10px] tracking-[0.18em] uppercase text-foreground/70">
          {fr ? `Ton camp · ${ep}` : `Your side · ${ep}`}
        </span>
        <span className="font-black text-lg" style={{ color: TEINTE[moi.camp] }}>
          TEAM {NOM_CAMP[moi.camp].toUpperCase()}
        </span>
        <span className="text-[11px] text-muted-foreground">{etat}</span>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {moi.best_ms != null && (
          <span className="font-black tabular-nums text-lg" style={{ color: TEINTE[moi.camp] }}>
            {secondes(moi.best_ms)} s
          </span>
        )}
        <button onClick={() => courir(moi.epreuve)}
                className="px-3 py-1.5 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest">
          {fr ? `COURIR LE ${ep.toUpperCase()}` : `RUN THE ${ep.toUpperCase()}`}
        </button>
      </div>
    </div>
  );
}

/** Les coureurs d'un camp sur une epreuve : ceux qui comptent, puis les autres. */
function Coureurs({ t, camp, epreuve, fr }: { t: TableauMarques; camp: Camp; epreuve: Epreuve; fr: boolean }) {
  const k = t.epreuves[epreuve];
  const liste = k.camps[camp].coureurs;
  const moiNom = getSavedName().trim().toLowerCase();
  if (!liste.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center px-6">
        {fr ? `Personne n’a encore couru le ${NOM_EPREUVE[epreuve]} pour ce camp.`
            : `Nobody has run the ${NOM_EPREUVE[epreuve]} for this side yet.`}
      </p>
    );
  }
  return (
    <div className="w-full flex flex-col gap-1">
      {liste.map((r, i) => {
        const moi = r.name.trim().toLowerCase() === moiNom;
        const compte = i < k.places;
        return (
          <React.Fragment key={r.name + i}>
            {i === k.places && (
              <span className="text-[9px] tracking-[0.2em] text-muted-foreground text-center pt-1">
                {fr ? 'NE COMPTENT PAS ENCORE' : 'NOT COUNTING YET'}
              </span>
            )}
            <div className={`flex items-center gap-3 px-3 py-1.5 rounded-lg
                             ${moi ? 'bg-primary/15 border border-primary/40' : 'bg-card/40'}
                             ${compte ? '' : 'opacity-50'}`}>
              <span className="w-6 text-right text-[11px] font-black tabular-nums text-foreground/60">{i + 1}</span>
              <span className="flex-1 min-w-0 truncate text-sm font-bold">{r.name}</span>
              <span className="font-black tabular-nums text-sm" style={{ color: TEINTE[camp] }}>{secondes(r.ms)}</span>
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}

/** Le choix, en trois gestes : un camp, une epreuve, la confirmation. Definitif. */
function ChoixDuCamp({ t, fr }: { t: TableauMarques; fr: boolean }) {
  const [camp, setCamp] = useState<Camp | null>(null);
  const [epreuve, setEpreuve] = useState<Epreuve | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<ChoixRefuse | null>(null);
  const nom = getSavedName();

  const fermer = () => { if (!envoi) { setCamp(null); setEpreuve(null); setRefus(null); } };
  const confirmer = async () => {
    if (!camp || !epreuve) return;
    setEnvoi(true); setRefus(null);
    const r = await choisirCamp(camp, epreuve);
    setEnvoi(false);
    if ('refus' in r && r.refus !== 'deja') setRefus(r.refus);
    else { setCamp(null); setEpreuve(null); }
  };

  const MOTS_REFUS: Record<ChoixRefuse, [string, string]> = {
    'nom': ['Choisis d’abord ton nom de coureur, sur l’accueil.', 'Pick your runner name first, on the home screen.'],
    'nom-reserve': ['Ce nom est réservé par un autre appareil.', 'This name is reserved by another device.'],
    'deja': ['', ''],
    'reseau': ['Pas de réseau. Réessaie.', 'No network. Try again.'],
  };

  /** Ce que vaut chaque epreuve pour ce camp, dit au moment du choix. */
  const atout = (c: Camp, e: Epreuve): string => {
    const m = manque(t, c, e);
    if (m > 0) return fr ? `${m} place${m > 1 ? 's' : ''} libre${m > 1 ? 's' : ''} : ta première course compte`
                         : `${m} open seat${m > 1 ? 's' : ''}: your first run counts`;
    const n = t.epreuves[e].camps[c].coureurs.length;
    if (!n) return fr ? 'personne encore : ouvre l’épreuve pour ton camp' : 'nobody yet: open the event for your side';
    return fr ? `${n} coureur${n > 1 ? 's' : ''} déjà : place au chrono` : `${n} runner${n > 1 ? 's' : ''} already: earn your seat`;
  };

  return (
    <div className="w-full flex flex-col gap-2">
      <span className="text-center text-[11px] font-black tracking-[0.2em] text-foreground/80">
        {fr ? 'QUEL CAMP DÉFENDS-TU ?' : 'WHICH SIDE DO YOU RUN FOR?'}
      </span>
      {!nom && (
        <p className="text-center text-[11px] text-muted-foreground">{fr ? MOTS_REFUS.nom[0] : MOTS_REFUS.nom[1]}</p>
      )}
      <div className="grid grid-cols-2 gap-2">
        {CAMPS.map(c => (
          <button key={c} disabled={!nom} onClick={() => setCamp(c)}
                  className="rounded-xl border-2 py-4 flex flex-col items-center gap-1 transition-colors
                             disabled:opacity-40 hover:bg-white/5"
                  style={{ borderColor: `${TEINTE[c]}99`, background: `${TEINTE[c]}10` }}>
            <span className="text-[10px] tracking-[0.2em] text-foreground/70">TEAM</span>
            <span className="font-black text-2xl" style={{ color: TEINTE[c] }}>{NOM_CAMP[c].toUpperCase()}</span>
          </button>
        ))}
      </div>
      <Mention fr={fr} />

      <AnimatePresence>
        {camp && (
          <motion.div {...VOILE} className="fixed inset-0 z-[59] bg-black/85 flex items-center justify-center px-5"
                      onClick={fermer}>
            <motion.div {...PANNEAU} onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-2xl border-2 p-5 flex flex-col items-center gap-3 bg-card"
                        style={{ borderColor: `${TEINTE[camp]}B0` }}>
              <span className="text-[10px] tracking-[0.2em] text-foreground/70">
                {fr ? 'TU DÉFENDS' : 'YOU RUN FOR'}
              </span>
              <span className="font-black text-3xl" style={{ color: TEINTE[camp] }}>
                TEAM {NOM_CAMP[camp].toUpperCase()}
              </span>
              <span className="text-[10px] tracking-[0.2em] text-foreground/70 pt-1">
                {fr ? 'SUR QUELLE ÉPREUVE ?' : 'ON WHICH EVENT?'}
              </span>
              <div className="w-full flex flex-col gap-1.5">
                {EPREUVES.map(e => (
                  <button key={e} onClick={() => setEpreuve(e)}
                          className={`w-full rounded-xl border px-3 py-2 flex items-center gap-3 text-left transition-colors
                                      ${epreuve === e ? 'border-primary bg-primary/15' : 'border-white/10 hover:bg-white/5'}`}>
                    <span className="font-black text-lg w-16 shrink-0">{NOM_EPREUVE[e]}</span>
                    <span className={`text-[11px] leading-snug ${manque(t, camp, e) > 0 ? 'text-primary' : 'text-muted-foreground'}`}>
                      {atout(camp, e)}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-center text-muted-foreground leading-snug">
                {fr ? 'C’est définitif jusqu’à la fin du duel. Seule cette épreuve comptera pour ton camp.'
                    : 'This is final until the duel ends. Only this event will count for your side.'}
              </p>
              {refus && (
                <p className="text-[12px] text-center text-red-300">{fr ? MOTS_REFUS[refus][0] : MOTS_REFUS[refus][1]}</p>
              )}
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <button onClick={fermer} disabled={envoi}
                        className="py-2 rounded-lg border border-white/15 text-[11px] font-black tracking-widest">
                  {fr ? 'ANNULER' : 'CANCEL'}
                </button>
                <button onClick={confirmer} disabled={envoi || !epreuve}
                        className="py-2 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest
                                   flex items-center justify-center gap-1.5 disabled:opacity-40">
                  {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {fr ? 'CONFIRMER' : 'CONFIRM'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
