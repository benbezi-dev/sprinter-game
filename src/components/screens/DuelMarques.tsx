import React, { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Loader2, Swords, Check } from 'lucide-react';
import { MONTEE, VOILE, PANNEAU } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getSavedName } from '@/game/leaderboard';
import {
  CAMPS, NOM_CAMP, fetchMarques, choisirCamp, monCamp, ecouterMarques, secondes, somme,
  type Camp, type TableauMarques, type ChoixRefuse,
} from '@/game/marques';
import { useRetour } from '@/hooks/use-retour';

/* ---------------------------------------------------------------------------
   LE DUEL DES MARQUES — Team adidas contre Team Nike (09/10/2026).

   La banniere de l'accueil, puis l'ecran : choisir son camp (une fois), voir
   les deux equipes de 32 et la somme qui les departage. Les regles sont dans
   worker/src/marques.js.

   AUCUN LOGO ET AUCUNE COULEUR DE MARQUE : un camp en blanc, l'autre dans le
   jaune du jeu. Et la mention de non-affiliation, sur l'ecran de choix ET
   sous le tableau — Sprinter n'est lie ni a adidas ni a Nike.
--------------------------------------------------------------------------- */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const TEINTE: Record<Camp, string> = { adidas: '#FFFFFF', nike: '#FFD426' };

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
  return { t, erreur, relire };
}

const MENTION_FR = 'Sprinter n’est ni affilié à adidas ni à Nike, ni soutenu par eux. Les deux noms désignent seulement les équipes que les joueurs choisissent.';
const MENTION_EN = 'Sprinter is not affiliated with, or endorsed by, adidas or Nike. The two names only label the teams players choose.';

/* ---------------------------------------------------------------- l'accueil */

export function BanderoleMarques() {
  const fr = useFr();
  const [ouvert, setOuvert] = useState(false);
  const [camp, setCamp] = useState<Camp | null>(monCamp());
  useEffect(() => ecouterMarques(() => setCamp(monCamp())), []);
  return (
    <motion.div {...MONTEE}>
      <button onClick={() => setOuvert(true)}
              className="w-full rounded-2xl border-2 border-primary/60 overflow-hidden flex items-center gap-3
                         px-3 py-2.5 text-left hover:bg-white/5 transition-colors"
              style={{ background: 'linear-gradient(100deg, rgba(255,255,255,0.10), rgba(255,212,38,0.14))' }}>
        <Swords className="w-7 h-7 text-primary shrink-0" aria-hidden />
        <span className="flex-1 min-w-0 flex flex-col">
          <span className="text-[9px] font-bold tracking-[0.22em] uppercase text-white/90">
            {fr ? 'Le duel de la semaine · 100 m' : 'Duel of the week · 100 m'}
          </span>
          <span className="font-black text-sm md:text-base leading-tight">
            <span style={{ color: TEINTE.adidas }}>TEAM ADIDAS</span>
            <span className="text-foreground/60"> vs </span>
            <span style={{ color: TEINTE.nike }}>TEAM NIKE</span>
          </span>
          <span className="text-[10px] md:text-xs text-foreground/65 leading-snug">
            {camp
              ? (fr ? `Tu cours pour Team ${NOM_CAMP[camp]}` : `You run for Team ${NOM_CAMP[camp]}`)
              : (fr ? 'Choisis ton camp, ton 100 m compte' : 'Pick your side, your 100 m counts')}
          </span>
        </span>
        <span className="shrink-0 px-2 py-1 rounded-lg text-black text-[10px] font-black tracking-widest bg-white">
          {camp ? (fr ? 'TABLEAU' : 'BOARD') : (fr ? 'CHOISIR' : 'PICK')}
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
  const [vue, setVue] = useState<Camp | null>(null);
  const moi = t?.moi || null;
  const affiche: Camp = vue || moi?.camp || 'adidas';

  const courir = () => {
    onClose();
    (SprinterApp as any).startOneShot(['100'], { levelIdx: 4 });
  };

  return (
    <motion.div {...MONTEE} className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-6 flex flex-col items-center gap-4">

        <div className="w-full flex items-start justify-between gap-3">
          <div className="flex flex-col min-w-0">
            <h2 className="font-black font-display tracking-tight text-xl md:text-2xl leading-tight">
              <span style={{ color: TEINTE.adidas }}>TEAM ADIDAS</span>
              <span className="text-foreground/50"> vs </span>
              <span style={{ color: TEINTE.nike }}>TEAM NIKE</span>
            </h2>
            <span className="text-[9px] md:text-[10px] text-muted-foreground tracking-wide">
              {fr ? '100 m · une semaine · 32 coureurs par équipe' : '100 m · one week · 32 runners per team'}
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
            ? `Ton meilleur 100 m de la semaine compte pour ton camp. Les ${t?.taille ?? 32} plus rapides de chaque camp forment l’équipe, et on peut déloger un sélectionné jusqu’à la fin. La plus petite somme des ${t?.taille ?? 32} chronos gagne. Une place vide compte ${secondes(t?.chaise_vide_ms ?? 15000)} s, et aucun chrono ne compte plus que ça : courir ne fait jamais perdre son camp.`
            : `Your best 100 m of the week counts for your side. The ${t?.taille ?? 32} fastest of each side make the team, and anyone can bump a selected runner until the end. The lowest sum of ${t?.taille ?? 32} times wins. An empty seat counts ${(t?.chaise_vide_ms ?? 15000) / 1000} s, and no time counts more than that: running never hurts your side.`}
        </p>

        {t && !moi && <ChoixDuCamp fr={fr} />}

        {t && moi && (
          <div className="w-full rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
               style={{ borderColor: `${TEINTE[moi.camp]}66`, background: `${TEINTE[moi.camp]}14` }}>
            <div className="flex flex-col min-w-0 leading-tight">
              <span className="text-[10px] tracking-[0.18em] uppercase text-foreground/70">
                {fr ? 'Ton camp' : 'Your side'}
              </span>
              <span className="font-black text-lg" style={{ color: TEINTE[moi.camp] }}>
                TEAM {NOM_CAMP[moi.camp].toUpperCase()}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {moi.best_ms == null
                  ? (fr ? 'Aucun 100 m encore cette semaine' : 'No 100 m yet this week')
                  : moi.selectionne
                    ? (fr ? `${moi.rang}ᵉ du camp · sélectionné` : `#${moi.rang} on your side · selected`)
                    : (fr ? `${moi.rang}ᵉ du camp · il faut ${secondes(t.camps[moi.camp].seuil_ms ?? 0)} pour entrer`
                          : `#${moi.rang} on your side · ${secondes(t.camps[moi.camp].seuil_ms ?? 0)} to get in`)}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {moi.best_ms != null && (
                <span className="font-black tabular-nums text-lg" style={{ color: TEINTE[moi.camp] }}>
                  {secondes(moi.best_ms)} s
                </span>
              )}
              <button onClick={courir}
                      className="px-3 py-1.5 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest">
                {fr ? 'COURIR' : 'RUN'}
              </button>
            </div>
          </div>
        )}

        {t && (
          <>
            <div className="w-full grid grid-cols-2 gap-1 p-1 rounded-xl bg-card/60 border border-white/5">
              {CAMPS.map(c => (
                <button key={c} onClick={() => setVue(c)}
                        className={`py-1.5 rounded-lg text-[11px] font-black tracking-widest transition-colors
                                    ${affiche === c ? 'bg-white/10' : 'hover:bg-white/5 text-foreground/60'}`}
                        style={affiche === c ? { color: TEINTE[c] } : undefined}>
                  TEAM {NOM_CAMP[c].toUpperCase()}
                </button>
              ))}
            </div>
            <Equipe t={t} camp={affiche} fr={fr} />
          </>
        )}

        {/* sous le tableau, une fois le camp choisi ; avant, l'ecran de choix la porte */}
        {t && moi && (
          <p className="w-full text-[9px] text-muted-foreground/60 text-center leading-snug px-4 pt-2">
            {fr ? MENTION_FR : MENTION_EN}
          </p>
        )}
      </div>
    </motion.div>
  );
}

/** Les deux totaux face a face, et l'ecart. */
function Score({ t, fr }: { t: TableauMarques; fr: boolean }) {
  const [a, b] = CAMPS;
  const ecart = Math.abs(t.camps[a].total_ms - t.camps[b].total_ms);
  return (
    <div className="w-full grid grid-cols-2 gap-2">
      {CAMPS.map(c => {
        const k = t.camps[c], devant = t.tete === c;
        return (
          <div key={c} className={`rounded-xl border px-3 py-3 flex flex-col items-center gap-0.5
                                   ${devant ? 'border-primary/60 bg-primary/10' : 'border-white/10 bg-card/60'}`}>
            <span className="text-[10px] font-black tracking-[0.18em]" style={{ color: TEINTE[c] }}>
              TEAM {NOM_CAMP[c].toUpperCase()}
            </span>
            <span className="font-black tabular-nums text-base md:text-lg">{somme(k.total_ms, fr)}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums text-center leading-tight">
              {fr ? `${k.equipe.length}/${t.taille} coureurs` : `${k.equipe.length}/${t.taille} runners`}
              {k.chaises_vides ? (fr ? ` · ${k.chaises_vides} places vides` : ` · ${k.chaises_vides} empty`) : ''}
            </span>
            <span className="text-[10px] text-muted-foreground/80">
              {fr ? `${k.inscrits} inscrit${k.inscrits > 1 ? 's' : ''}` : `${k.inscrits} signed up`}
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
  );
}

/** Les 32 d'un camp, et le chrono a battre pour y entrer. */
function Equipe({ t, camp, fr }: { t: TableauMarques; camp: Camp; fr: boolean }) {
  const k = t.camps[camp];
  const moiNom = getSavedName().trim().toLowerCase();
  if (!k.equipe.length) {
    return (
      <p className="text-sm text-muted-foreground py-6 text-center px-6">
        {fr ? 'Personne n’a encore couru pour ce camp. La première place est libre.'
            : 'Nobody has run for this side yet. The first seat is free.'}
      </p>
    );
  }
  return (
    <div className="w-full flex flex-col gap-1">
      {k.equipe.map((r, i) => {
        const moi = r.name.trim().toLowerCase() === moiNom;
        return (
          <div key={r.name + i}
               className={`flex items-center gap-3 px-3 py-1.5 rounded-lg
                           ${moi ? 'bg-primary/15 border border-primary/40' : 'bg-card/40'}`}>
            <span className="w-6 text-right text-[11px] font-black tabular-nums text-foreground/60">{i + 1}</span>
            <span className="flex-1 min-w-0 truncate text-sm font-bold">{r.name}</span>
            <span className="font-black tabular-nums text-sm" style={{ color: TEINTE[camp] }}>{secondes(r.ms)}</span>
          </div>
        );
      })}
      {k.chaises_vides > 0 && (
        <p className="text-[10px] text-muted-foreground text-center pt-1">
          {fr ? `${k.chaises_vides} places libres : n’importe quel 100 m t’y fait entrer.`
              : `${k.chaises_vides} free seats: any 100 m gets you in.`}
        </p>
      )}
    </div>
  );
}

/** Le choix, en deux gestes : on touche un camp, puis on confirme. Definitif. */
function ChoixDuCamp({ fr }: { fr: boolean }) {
  const [vise, setVise] = useState<Camp | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [refus, setRefus] = useState<ChoixRefuse | null>(null);
  const nom = getSavedName();

  const confirmer = async () => {
    if (!vise) return;
    setEnvoi(true); setRefus(null);
    const r = await choisirCamp(vise);
    setEnvoi(false);
    if ('refus' in r && r.refus !== 'deja') setRefus(r.refus);
    else setVise(null);
  };

  const MOTS_REFUS: Record<ChoixRefuse, [string, string]> = {
    'nom': ['Choisis d’abord ton nom de coureur, sur l’accueil.', 'Pick your runner name first, on the home screen.'],
    'nom-reserve': ['Ce nom est réservé par un autre appareil.', 'This name is reserved by another device.'],
    'deja': ['', ''],
    'reseau': ['Pas de réseau. Réessaie.', 'No network. Try again.'],
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
          <button key={c} disabled={!nom} onClick={() => setVise(c)}
                  className="rounded-xl border-2 py-4 flex flex-col items-center gap-1 transition-colors
                             disabled:opacity-40 hover:bg-white/5"
                  style={{ borderColor: `${TEINTE[c]}99`, background: `${TEINTE[c]}10` }}>
            <span className="text-[10px] tracking-[0.2em] text-foreground/70">TEAM</span>
            <span className="font-black text-2xl" style={{ color: TEINTE[c] }}>{NOM_CAMP[c].toUpperCase()}</span>
          </button>
        ))}
      </div>
      <p className="text-[9px] text-muted-foreground/70 text-center leading-snug px-3">{fr ? MENTION_FR : MENTION_EN}</p>

      <AnimatePresence>
        {vise && (
          <motion.div {...VOILE} className="fixed inset-0 z-[59] bg-black/85 flex items-center justify-center px-6"
                      onClick={() => !envoi && setVise(null)}>
            <motion.div {...PANNEAU} onClick={e => e.stopPropagation()}
                        className="w-full max-w-md rounded-2xl border-2 p-5 flex flex-col items-center gap-3 bg-card"
                        style={{ borderColor: `${TEINTE[vise]}B0` }}>
              <span className="text-[10px] tracking-[0.2em] text-foreground/70">
                {fr ? 'TU DÉFENDS' : 'YOU RUN FOR'}
              </span>
              <span className="font-black text-3xl" style={{ color: TEINTE[vise] }}>
                TEAM {NOM_CAMP[vise].toUpperCase()}
              </span>
              <p className="text-[12px] text-center text-muted-foreground leading-snug">
                {fr ? 'C’est définitif jusqu’à la fin du duel. Chacun de tes 100 m comptera pour ce camp.'
                    : 'This is final until the duel ends. Every 100 m you run will count for this side.'}
              </p>
              {refus && (
                <p className="text-[12px] text-center text-red-300">{fr ? MOTS_REFUS[refus][0] : MOTS_REFUS[refus][1]}</p>
              )}
              <div className="w-full grid grid-cols-2 gap-2 pt-1">
                <button onClick={() => setVise(null)} disabled={envoi}
                        className="py-2 rounded-lg border border-white/15 text-[11px] font-black tracking-widest">
                  {fr ? 'ANNULER' : 'CANCEL'}
                </button>
                <button onClick={confirmer} disabled={envoi}
                        className="py-2 rounded-lg bg-primary text-black text-[11px] font-black tracking-widest
                                   flex items-center justify-center gap-1.5">
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
