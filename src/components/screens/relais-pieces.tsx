import React from 'react';
import { motion } from 'framer-motion';
import { Flag, XCircle, Hand } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { ARRIVEE, LEG, TAILLE, type Zone } from '@/game/salle-relais';

/**
 * Les pieces communes aux deux courses de relais.
 *
 * Une equipe seule et une confrontation de huit affichent les memes choses :
 * une marque a poser dans sa zone, un temoin qui avance, un bouton a taper au
 * bon moment, une fin. Elles ne different que par le nombre de couloirs.
 *
 * Elles vivent ici pour la meme raison que les regles du temoin vivent dans un
 * module a part cote serveur : deux copies d'un bouton de transmission, c'est
 * la garantie qu'un jour l'une s'activera dans une fenetre ou l'autre reste
 * grise, et le joueur n'aura aucun moyen de savoir laquelle a raison.
 */

export const chrono = (ms: number) => (ms / 1000).toFixed(2) + ' s';
export const NOTES = ['raté', 'correct', 'parfait'];

/**
 * Les couleurs des equipes, dans l'ordre d'entree.
 *
 * Huit teintes ecartees les unes des autres — mais jamais la couleur seule :
 * chaque couloir porte aussi le code de l'equipe et le rang de son relayeur.
 * Un joueur qui ne distingue pas le vert du rouge doit pouvoir suivre la
 * course, et de toute facon huit couleurs sur un ecran de telephone ne se
 * lisent pas de loin.
 */
export const COULEURS = [
  '#34d399', '#f8cd4a', '#60a5fa', '#f472b6',
  '#a78bfa', '#fb923c', '#2dd4bf', '#f87171',
];
export const couleurDe = (i: number) => COULEURS[i % COULEURS.length];

/* ------------------------------------------------------------- la marque */

/**
 * Le placement de la marque.
 *
 * Trente metres de zone, et le choix de l'endroit ou l'on se place dedans.
 * Devant, on part plus tot et l'on prend de la vitesse, mais on risque de
 * sortir de la zone avant que le temoin n'arrive. Derriere, on est sur de
 * l'avoir, et l'on part a l'arret.
 */
export function Marque({ zone, valeur, onChange }: {
  zone: Zone; valeur: number; onChange: (d: number) => void;
}) {
  const { N } = SprinterApp;
  const part = (valeur - zone.debut) / (zone.fin - zone.debut);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-widest text-muted-foreground">
          {N.t('relais_ta_marque')}
        </span>
        <span className="font-mono text-xs tabular-nums text-emerald-300">
          {Math.round(valeur - zone.debut)} m
        </span>
      </div>
      <input
        type="range" min={zone.debut} max={zone.fin} step={0.5} value={valeur}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400"
        aria-label={N.t('relais_ta_marque')}
      />
      <div className="relative h-6 rounded-lg bg-black/40 border border-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-emerald-400/15"
             style={{ width: `${part * 100}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-emerald-400"
             style={{ left: `${part * 100}%` }} />
        <span className="absolute inset-0 flex items-center justify-between px-2
                         text-[8px] tracking-widest text-muted-foreground/70">
          <span>{N.t('relais_zone_debut')}</span>
          <span>{N.t('relais_zone_fin')}</span>
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        {N.t('relais_marque_conseil')}
      </p>
    </div>
  );
}

/* ------------------------------------------------------------- un couloir */

/**
 * Le temoin d'une equipe sur quatre cents metres.
 *
 * Les trois traits sont les zones de transmission : c'est la que la course se
 * gagne et se perd, et les voir permet de comprendre pourquoi une equipe vient
 * d'etre eliminee. Sans eux, une elimination « hors de la zone » est un verdict
 * sans piece a conviction.
 */
export function Couloir({ nom, code, d, porteur, couleur, moi, elimine, total, fantome }: {
  nom: string; code: string; d: number; porteur: number; couleur: string;
  moi?: boolean; elimine?: boolean; total?: number | null; fantome?: boolean;
}) {
  const { N } = SprinterApp;
  const part = Math.max(0, Math.min(1, d / ARRIVEE));
  return (
    <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border
      ${moi ? 'border-white/25 bg-white/[0.06]' : 'border-white/8 bg-black/25'}
      ${elimine ? 'opacity-45' : ''}`}>
      <span className="w-1.5 h-6 rounded-full shrink-0" style={{ background: couleur }} />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11px] font-bold tracking-wide truncate text-foreground">
            {nom}
          </span>
          <span className="font-mono text-[9px] text-muted-foreground shrink-0">{code}</span>
          {fantome && (
            <span className="text-[8px] tracking-widest text-cyan-300 shrink-0">
              {N.t('relais_fantome')}
            </span>
          )}
        </div>
        <div className="relative h-1.5 mt-1 rounded-full bg-white/8 overflow-hidden">
          {[1, 2, 3].map(k => (
            <span key={k} className="absolute inset-y-0 w-px bg-white/25"
                  style={{ left: `${(k * LEG / ARRIVEE) * 100}%` }} />
          ))}
          <motion.span
            className="absolute inset-y-0 left-0 rounded-full"
            style={{ background: couleur }}
            animate={{ width: `${part * 100}%` }}
            transition={{ duration: 0.12, ease: 'linear' }}
          />
        </div>
      </div>
      <span className="font-mono text-[10px] tabular-nums shrink-0 w-14 text-right
                       text-muted-foreground">
        {total != null ? chrono(total)
          : elimine ? '—'
          : `${Math.round(d)} m`}
      </span>
      <span className="font-mono text-[9px] w-3 shrink-0 text-center text-muted-foreground">
        {total != null || elimine ? '' : porteur}
      </span>
    </div>
  );
}

/* --------------------------------------------------------- le bouton du temoin */

/**
 * La tape.
 *
 * Elle n'est offerte que quand elle a un sens : le porteur peut donner des
 * qu'il court, le receveur seulement quand le temoin approche de sa zone.
 * Proposer le bouton plus tot inviterait a taper dans le vide, et une tape
 * hors zone elimine l'equipe entiere.
 */
export function BoutonTemoin({ role, arme, onTaper }: {
  role: 'donne' | 'recoit'; arme: boolean; onTaper: () => void;
}) {
  const { N } = SprinterApp;
  const donne = role === 'donne';
  return (
    <button
      onPointerDown={onTaper}
      disabled={!arme}
      className={`w-full py-5 rounded-2xl font-black font-display tracking-widest text-lg
        pointer-events-auto transition-colors
        ${!arme ? 'bg-white/5 text-white/25 border border-white/10'
          : donne ? 'bg-primary text-background'
                  : 'bg-emerald-400 text-background animate-pulse'}`}>
      <Hand className="w-6 h-6 mx-auto mb-1" />
      {N.t(donne ? 'relais_donne' : arme ? 'relais_prends' : 'relais_attends_temoin')}
    </button>
  );
}

/* ---------------------------------------------------------------- la fin */

export type FinPasse = { de: number; vers: number; note: number };

export function Fin({ titre, rate, detail, temps, passes, place, onFermer, enfants }: {
  titre: string;
  rate: boolean;
  detail?: string;
  temps?: number | null;
  passes?: FinPasse[];
  place?: number | null;
  onFermer: () => void;
  enfants?: React.ReactNode;
}) {
  const { N } = SprinterApp;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 py-8
                    overflow-y-auto bg-[#05070d]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-sm flex flex-col items-center gap-4">
        {rate ? <XCircle className="w-7 h-7 text-destructive" />
              : <Flag className="w-7 h-7 text-emerald-400" />}
        <h2 className={`font-display font-black tracking-widest text-center text-xl
                        ${rate ? 'text-destructive' : 'text-emerald-400'}`}>
          {titre}
        </h2>

        {rate ? (
          <p className="text-center text-xs text-white/60 leading-relaxed max-w-[28ch]">
            {detail}
          </p>
        ) : (
          <div className="flex flex-col items-center gap-1">
            {place != null && (
              <span className="font-display font-black tracking-widest text-primary text-sm">
                {N.ord(place)}
              </span>
            )}
            <p className="font-mono font-black text-4xl tabular-nums text-emerald-300">
              {chrono(temps || 0)}
            </p>
          </div>
        )}

        {enfants}

        {/* Les trois passages, notes. C'est la que se gagne un relais : trois
            transmissions parfaites valent plus qu'un relayeur rapide. */}
        {passes && passes.length > 0 && (
          <div className="w-full flex flex-col gap-1.5 mt-1">
            <span className="text-[9px] tracking-widest text-muted-foreground text-center">
              {N.t('relais_passages')}
            </span>
            {passes.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                      border border-white/8 bg-black/25">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {p.de} → {p.vers}
                </span>
                <span className="flex-1" />
                <span className={`text-[10px] font-bold tracking-widest
                  ${p.note >= 2 ? 'text-emerald-300' : p.note >= 1 ? 'text-primary' : 'text-destructive'}`}>
                  {NOTES[Math.max(0, Math.min(2, p.note))]}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onFermer}
          className="mt-2 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background bg-emerald-400 text-sm">
          {N.t('champ_continue')}
        </button>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------- le salon d'avant-course */

/** La liste des relayeurs et leur etat de preparation. */
export function Vestiaire({ joueurs, monRelais }: {
  joueurs: { id: string; nom: string; relais: number; pret: boolean }[];
  monRelais: number;
}) {
  const { N } = SprinterApp;
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: TAILLE }, (_, i) => i + 1).map(rang => {
        const j = joueurs.find(x => x.relais === rang);
        return (
          <div key={rang} className={`flex items-center gap-2 px-3 py-2 rounded-xl border
            ${j?.pret ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
              : j ? 'border-white/10 bg-black/25'
                  : 'border-white/8 bg-black/15 border-dashed'}`}>
            <span className="font-mono text-[10px] w-4 text-muted-foreground">{rang}</span>
            <span className={`flex-1 text-xs font-bold truncate
              ${rang === monRelais ? 'text-emerald-300' : 'text-foreground'}`}>
              {j ? j.nom : '—'}
            </span>
            <span className={`text-[9px] tracking-widest
              ${j?.pret ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {j ? N.t(j.pret ? 'live_ready' : 'live_notready') : ''}
            </span>
          </div>
        );
      })}
    </div>
  );
}
