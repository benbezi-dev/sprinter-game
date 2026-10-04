import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Check, Eye, EyeOff, Radio } from 'lucide-react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { MONTEE } from '@/lib/mouvement';
import { tournoiLance, type EtatTournoi, type JoueurSalle, type Salle } from '@/game/live';
import { useSalonDirect } from '@/game/salon-direct';
import {
  classementDuTournoi, nomDeManche, useRegardTournoi, regarderLaSuite,
  suivreEnTournoi, oublierLeRegard,
} from '@/game/tournoi-direct';
import { RevancheDirecte } from './RevancheDirecte';

/* ---------------------------------------------------------------------------
   LE TOURNOI A ELIMINATION, A L'ECRAN
   ---------------------------------------------------------------------------
   Quatre pieces, et trois endroits ou elles se montrent :

   - le TABLEAU du tournoi — qui court encore, qui est sorti et a quelle
     manche, le champion — au salon comme sur l'ecran de fin ;
   - le bouton PRET de la manche suivante, avec son compte a rebours : elle
     part toute seule, et l'on doit savoir dans combien de temps ;
   - le BLOC de l'ecran de fin, qui remplace la revanche tant que le tournoi
     se court ;
   - le BANDEAU des tribunes, par-dessus la piste, pour un elimine qui regarde.
--------------------------------------------------------------------------- */

/** Les secondes qui restent avant une date de la salle ; nul sans date. */
function useSecondesAvant(dateServeur: number | null | undefined, s: Salle | null): number | null {
  const [, tic] = useState(0);
  useEffect(() => {
    if (!dateServeur) return;
    const i = setInterval(() => tic(x => x + 1), 250);
    return () => clearInterval(i);
  }, [dateServeur]);
  if (!dateServeur || !s) return null;
  return Math.max(0, Math.ceil((s.versLocal(dateServeur) - Date.now()) / 1000));
}

/** Le nom de la manche qui vient — ou qui se court. */
function prochaineManche(t: EtatTournoi): string {
  const { N } = SprinterApp;
  const enCours = t.etat === 'manche';
  return nomDeManche(N, enCours ? t.manche : t.manche + 1, t.manches, t.en_lice.length);
}

/**
 * LE TABLEAU DU TOURNOI. Ceux qui courent encore, par couloir — coches quand
 * ils sont prets pour la suite — puis les elimines du mieux place au premier
 * sorti. Une fois le tournoi fini, le champion en tete.
 */
export function TableauTournoi({ t, joueurs, moi }: {
  t: EtatTournoi; joueurs: JoueurSalle[]; moi: string;
}) {
  const { N } = SprinterApp;
  const lignes = classementDuTournoi(t, joueurs);
  const pret = (id: string) => t.etat === 'pause' && !!joueurs.find(j => j.id === id)?.pret;
  const couloir = (id: string) => joueurs.find(j => j.id === id)?.couloir;
  return (
    <div className="w-full flex flex-col gap-1">
      <span className="text-[9px] md:text-[10px] font-bold tracking-[0.25em] text-muted-foreground text-center">
        {N.t('tournoi_classement')}
      </span>
      <div className="w-full rounded-xl border border-white/10 bg-black/25 divide-y divide-white/5">
        {lignes.map(l => {
          const toi = l.id === moi;
          const enLice = l.place == null;
          return (
            <div key={l.id}
                 className={`flex items-center justify-between gap-2 px-3 py-1.5
                   ${toi ? 'bg-primary/10' : ''} ${!enLice && !l.champion ? 'opacity-70' : ''}`}>
              <span className="flex items-center gap-2 min-w-0">
                <span className={`font-mono font-bold w-6 shrink-0 text-center text-[10px] md:text-xs
                  ${l.champion ? 'text-primary' : enLice ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                  {l.champion ? <Trophy className="w-3.5 h-3.5 inline" />
                    : enLice ? (couloir(l.id) ?? '·') : `${l.place}.`}
                </span>
                <span className={`font-bold tracking-wide truncate text-xs md:text-sm
                  ${toi ? 'text-primary' : 'text-foreground'}`}>
                  {toi ? N.t('duel_you') : l.nom}
                </span>
              </span>
              <span className={`shrink-0 flex items-center gap-1 text-[9px] md:text-[10px] font-bold tracking-widest uppercase
                ${l.champion ? 'text-primary' : enLice ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                {pret(l.id) && <Check className="w-3 h-3" />}
                {l.champion ? N.t('tournoi_champion')
                  : enLice ? N.t('tournoi_en_lice')
                  : l.forfait ? N.t('tournoi_forfait')
                  : N.t('tournoi_sorti', { m: l.manche })}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * LA SUITE DU TOURNOI, vue de soi.
 *
 * En lice, pendant la pause : le compte a rebours et le bouton PRET — la
 * manche part a la fin du compte, ou des que tous ceux qui restent l'ont dit.
 * Pendant une manche : rien a faire, on le dit. Elimine : l'envie de regarder
 * la suite depuis les tribunes, qu'on peut retirer.
 */
export function PretTournoi() {
  const s = useSalonDirect();
  const { N } = SprinterApp;
  const regard = useRegardTournoi();
  const t = s?.dernierEtat?.tournoi;
  const secondes = useSecondesAvant(t?.etat === 'pause' ? t.prochaine_a : null, s);
  if (!s || !t || !tournoiLance(t)) return null;

  if (s.elimineMoi) {
    return (
      <div className="w-full flex flex-col items-center gap-1.5">
        <button
          onClick={() => regarderLaSuite(!regard.regarder)}
          aria-pressed={regard.regarder}
          className={`w-full py-2.5 rounded-xl font-black font-display tracking-widest text-xs md:text-sm
            transition-colors flex items-center justify-center gap-2 border
            ${regard.regarder
              ? 'bg-emerald-400/15 text-emerald-300 border-emerald-400/40'
              : 'bg-black/30 text-muted-foreground border-white/10'}`}
        >
          {regard.regarder ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          {N.t('tournoi_regarder')}
        </button>
        <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
          {N.t(regard.regarder ? 'tournoi_regarder_oui' : 'tournoi_regarder_non')}
        </p>
      </div>
    );
  }

  if (t.etat === 'manche') {
    return (
      <div className="w-full py-2.5 rounded-xl font-black font-display tracking-widest text-xs md:text-sm
                      text-emerald-300 bg-emerald-400/10 border border-emerald-400/30
                      flex items-center justify-center gap-2">
        <Radio className="w-4 h-4 animate-pulse" />
        {N.t('tournoi_en_piste')}
      </div>
    );
  }

  const finale = t.en_lice.length === 2;
  const moiPret = s.pretMoi;
  const attendus = (s.dernierEtat?.joueurs || [])
    .filter(j => j.id !== s.moi && t.en_lice.includes(j.id) && !j.pret).map(j => j.nom);
  return (
    <div className="w-full flex flex-col items-center gap-1.5">
      {secondes != null && (
        <p className="font-mono text-xs md:text-sm font-bold tracking-wide text-emerald-300 text-center tabular-nums">
          {N.t(finale ? 'tournoi_suivante_finale' : 'tournoi_suivante', { s: secondes })}
        </p>
      )}
      <button
        onClick={() => s.pret(!moiPret)}
        className={`w-full py-2.5 rounded-xl font-black font-display tracking-widest text-xs md:text-sm
          transition-colors flex items-center justify-center gap-2
          ${moiPret ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : 'bg-emerald-400 text-background hover:bg-emerald-400/90'}`}
      >
        {moiPret && <Check className="w-4 h-4" />}
        {moiPret ? N.t('live_unready') : N.t(finale ? 'tournoi_pret_finale' : 'tournoi_pret')}
      </button>
      <p className="text-[10px] md:text-xs text-muted-foreground text-center leading-snug">
        {moiPret && attendus.length
          ? N.t('tournoi_attente', { n: attendus.join(', ') })
          : N.t('tournoi_pause_sub')}
      </p>
    </div>
  );
}

/**
 * LE TOURNOI SUR L'ECRAN DE FIN D'UNE MANCHE.
 *
 * Tant qu'il se court, il remplace la revanche : la suite n'est pas une
 * revanche, c'est la manche suivante, et elle part sans qu'on la demande. Une
 * fois le champion connu — ou la piste refermee — on retrouve la revanche
 * ordinaire, qui relance un tournoi neuf quand tout le monde a dit oui.
 */
export function BlocTournoi() {
  const s = useSalonDirect();
  const { N } = SprinterApp;
  const t = s?.dernierEtat?.tournoi;
  if (!s || !t) return null;
  const coupee = s.coupee && !s.enVie();
  const joueurs = s.dernierEtat?.joueurs || [];

  if (!tournoiLance(t) || coupee) {
    return (
      <>
        {t.etat === 'fini' && (t.champion || t.elimines.length > 0) && (
          <motion.div {...MONTEE}
            className="w-full rounded-2xl border border-primary/40 bg-primary/[0.07] px-4 py-3
                       flex flex-col items-center gap-2 shadow-2xl">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-primary" />
              <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-primary">
                {!t.champion ? N.t('tournoi_titre')
                  : t.champion.id === s.moi ? N.t('tournoi_sacre_toi')
                  : N.t('tournoi_sacre', { n: t.champion.nom })}
              </span>
            </div>
            <TableauTournoi t={t} joueurs={joueurs} moi={s.moi} />
          </motion.div>
        )}
        <RevancheDirecte titre={N.t('tournoi_rejouer_q')} bouton={N.t('tournoi_rejouer')} />
      </>
    );
  }

  return (
    <motion.div {...MONTEE}
      className="w-full rounded-2xl border border-emerald-400/40 bg-emerald-400/[0.06] px-4 py-3
                 court:px-3 court:py-2 flex flex-col items-center gap-2 shadow-2xl">
      <div className="flex items-center gap-2">
        <Trophy className="w-4 h-4 text-emerald-400" />
        <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-emerald-300">
          {N.t('tournoi_titre')} · {prochaineManche(t)}
        </span>
      </div>
      <TableauTournoi t={t} joueurs={joueurs} moi={s.moi} />
      <PretTournoi />
    </motion.div>
  );
}

/**
 * LES TRIBUNES. Un elimine regarde la manche : le bandeau dit qu'il est sorti
 * et laquelle se court, les couloirs se touchent pour changer de coureur
 * suivi, et au verdict il dit qui sort avant de ramener au salon.
 */
export function BandeauTournoi() {
  // Ce qu'il lit du moteur, par selecteurs : il est toujours monte, et ne se
  // redessine plus a chaque image (voir useGameStore).
  const state = useGameStore(s => s.state);
  const liveOn = useGameStore(s => !!s.liveOn);
  const spectateur = useGameStore(() => !!SprinterApp.G.spectateur);
  const champDirect = useGameStore(() => !!SprinterApp.G.champDirect);
  const presentation = useGameStore(s => s.state === 'count' && s.countT <= -90);
  const s = useSalonDirect();
  const regard = useRegardTournoi();
  const { N } = SprinterApp;
  if (!spectateur || !liveOn || champDirect) return null;
  if (state !== 'count' && state !== 'race') return null;
  // Pendant la presentation de la finale, la presentation parle seule.
  if (presentation) return null;
  const t = s?.dernierEtat?.tournoi;
  const joueurs = s?.dernierEtat?.joueurs || [];
  const enPiste = joueurs.filter(j => j.en_lice !== false)
    .sort((a, b) => (a.couloir || 0) - (b.couloir || 0));
  const r = regard.resultat;
  const nomDe = (id: string) => r?.classement.find(l => l.id === id)?.nom || '';
  const sortis = (r?.tournoi?.elimines || []).map(nomDe).filter(Boolean);

  return (
    <motion.div {...MONTEE}
      className="absolute top-[calc(max(env(safe-area-inset-top),0.75rem)+2.25rem)] left-0 right-0 z-30
                 flex flex-col items-center gap-2 px-4 pointer-events-none">
      <div className="px-3 py-1 rounded-full text-[10px] font-black tracking-[0.3em] bg-destructive text-white">
        {N.t('tournoi_tribune')}
      </div>
      {t && !r && t.etat === 'manche' && (
        <div className="px-3 py-0.5 rounded-full text-[10px] font-bold tracking-[0.25em]
                        bg-black/60 text-white/80 border border-white/15">
          {nomDeManche(N, t.manche, t.manches, t.en_lice.length)}
        </div>
      )}
      {!r && (
        <div className="flex gap-1.5 pointer-events-auto">
          {enPiste.map(j => (
            <button key={j.id} onClick={() => suivreEnTournoi(j.id)}
              title={j.nom}
              className={`min-w-7 h-7 px-1.5 rounded-md text-[11px] font-black tabular-nums border
                active:scale-95 transition
                ${regard.suivi === j.id ? 'bg-white text-black border-white' : 'bg-black/55 text-white border-white/25'}`}>
              {j.couloir}
            </button>
          ))}
        </div>
      )}
      {r && (
        <div className="pointer-events-auto w-full max-w-xs rounded-2xl border border-white/15 bg-black/75
                        backdrop-blur-md px-4 py-3 flex flex-col items-center gap-2">
          <span className="text-xs md:text-sm font-bold text-center text-foreground">
            {r.tournoi?.fini && r.tournoi.champion
              ? N.t('tournoi_sacre', { n: r.tournoi.champion.nom })
              : sortis.length
                ? N.t(sortis.length > 1 ? 'tournoi_sortent' : 'tournoi_sort', { n: sortis.join(', ') })
                : N.t('tournoi_personne')}
          </span>
          <div className="w-full flex flex-col gap-0.5">
            {r.classement.map(l => (
              <div key={l.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className={`truncate ${l.elimine ? 'text-destructive' : 'text-foreground'}`}>
                  {l.place}. {l.nom}
                </span>
                <span className={`font-mono shrink-0 ${l.elimine ? 'text-destructive' : 'text-muted-foreground'}`}>
                  {l.abandon ? N.t('dnf') : `${(l.ms / 1000).toFixed(2)} s`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <button
        onClick={() => { oublierLeRegard(); SprinterApp.goHome(); }}
        className="pointer-events-auto px-3 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em]
                   bg-black/60 text-white/85 border border-white/20 hover:bg-black/75 transition-colors">
        {N.t('tournoi_retour')}
      </button>
    </motion.div>
  );
}
