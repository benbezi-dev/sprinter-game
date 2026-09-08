import React, { useEffect, useState } from 'react';
import { Loader2, Search, Check, Trophy } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import {
  fetchTopPlayers, getSavedName, type RaceKey, type TopPlayer,
} from '@/game/leaderboard';

/**
 * Choisir ses coequipiers dans le TOP 500.
 *
 * Un relais se monte avec des noms, et un nom mal orthographie n'invite
 * personne : l'equipe attend une reponse qui ne viendra jamais. Le tableau
 * mondial est le seul annuaire que le jeu possede — on l'ouvre donc ici, a
 * cote des champs, plutot que de laisser chacun deviner comment son ami a
 * ecrit son pseudo.
 *
 * La saisie libre reste : tout le monde n'est pas au tableau, et un ami a qui
 * l'on vient de faire installer le jeu doit pouvoir etre invite avant d'avoir
 * couru. Cette liste s'ajoute au clavier, elle ne le remplace pas.
 *
 * L'epreuve se choisit parce que le tableau est tenu par discipline. Le 4×100
 * ouvre sur le 100 m, mais un coureur qui n'a jamais fait que du 400 n'y
 * figure pas — et il serait absurde de ne pas pouvoir l'inviter pour ca.
 */

const EPREUVES: RaceKey[] = ['100', '200', '400'];
const chrono = (ms: number) => (ms / 1000).toFixed(2) + ' s';

/**
 * Cinq cents boutons d'un coup ne se lisent pas et rament sur telephone. On
 * en montre le haut, et la recherche fait le reste — c'est de toute facon
 * ainsi qu'on cherche quelqu'un qu'on connait deja.
 */
const MAX_AFFICHE = 60;

const cle = (s: string) => s.trim().toLowerCase();

export function ChoixCoureurs({ coequipiers, onChanger }: {
  coequipiers: string[];
  onChanger: (v: string[]) => void;
}) {
  const { N } = SprinterApp;
  const [ouvert, setOuvert] = useState(false);
  const [race, setRace] = useState<RaceKey>('100');
  const [liste, setListe] = useState<TopPlayer[] | null>(null);
  const [muet, setMuet] = useState(false);
  const [q, setQ] = useState('');

  // On ne va chercher le tableau qu'a l'ouverture : la plupart des equipes se
  // montent entre gens qui se connaissent, sans jamais deplier la liste.
  useEffect(() => {
    if (!ouvert) return;
    let annule = false;
    setListe(null); setMuet(false);
    fetchTopPlayers(race)
      .then(l => { if (!annule) setListe(l); })
      .catch(() => { if (!annule) setMuet(true); });
    return () => { annule = true; };
  }, [ouvert, race]);

  const moi = cle(getSavedName() || '');
  const pris = new Set(coequipiers.map(cle).filter(Boolean));
  const complet = coequipiers.every(c => c.trim());

  /**
   * Une seconde touche retire le nom : sans cela, se tromper de coureur
   * obligerait a refermer la liste pour aller vider un champ a la main.
   */
  const basculer = (nom: string) => {
    const k = cle(nom);
    if (pris.has(k)) { onChanger(coequipiers.map(c => cle(c) === k ? '' : c)); return; }
    const libre = coequipiers.findIndex(c => !c.trim());
    if (libre < 0) return;                       // les trois places sont prises
    onChanger(coequipiers.map((c, i) => (i === libre ? nom : c)));
  };

  const filtre = cle(q);
  const trouves = (liste || []).filter(p => !filtre || cle(p.name).includes(filtre));
  const visibles = trouves.slice(0, MAX_AFFICHE);
  const caches = trouves.length - visibles.length;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOuvert(o => !o)}
        aria-expanded={ouvert}
        className="w-full py-2 rounded-xl font-bold tracking-widest text-[10px]
                   border border-primary/40 bg-primary/10 text-primary
                   hover:bg-primary/20 flex items-center justify-center gap-1.5"
      >
        <Trophy className="w-3 h-3" />
        {N.t(ouvert ? 'relais_top_fermer' : 'relais_top_ouvrir')}
      </button>

      {ouvert && (
        <div className="flex flex-col gap-2 p-2.5 rounded-2xl border border-white/10 bg-black/25">
          <div className="flex items-center gap-1.5">
            {EPREUVES.map(k => (
              <button
                key={k} type="button" onClick={() => setRace(k)}
                aria-pressed={race === k}
                className={`flex-1 py-1.5 rounded-lg font-mono text-[10px] font-bold border
                  ${race === k ? 'border-primary/50 bg-primary/15 text-primary'
                               : 'border-white/10 bg-black/25 text-muted-foreground'}`}
              >
                {k} M
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl
                          bg-black/40 border border-white/10">
            <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
            <input
              value={q} onChange={e => setQ(e.target.value)} maxLength={20}
              placeholder={N.t('relais_top_chercher')}
              className="flex-1 min-w-0 bg-transparent text-sm text-foreground
                         placeholder:text-muted-foreground focus:outline-none"
            />
          </div>

          {liste === null && !muet && (
            <div className="flex justify-center py-3">
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
          )}

          {muet && (
            <p className="text-[10px] text-center text-muted-foreground leading-snug">
              {N.t('relais_top_muet')}
            </p>
          )}

          {liste !== null && trouves.length === 0 && (
            <p className="text-[10px] text-center text-muted-foreground leading-snug">
              {N.t('relais_top_aucun')}
            </p>
          )}

          {visibles.length > 0 && (
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {visibles.map(p => {
                const k = cle(p.name);
                const choisi = pris.has(k);
                const soi = k === moi;
                // Le serveur refuse un relais avec un doublon : autant le dire
                // en grisant la ligne plutot qu'en laissant partir une equipe
                // qui sera rejetee a l'envoi.
                const bloque = soi || (!choisi && complet);
                return (
                  <button
                    key={p.rank + '-' + k} type="button"
                    onClick={() => basculer(p.name)} disabled={bloque}
                    aria-pressed={choisi}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left
                      disabled:opacity-30
                      ${choisi ? 'border-emerald-400/50 bg-emerald-400/[0.10]'
                               : 'border-white/8 bg-black/25'}`}
                  >
                    <span className="font-mono text-[10px] w-7 shrink-0 tabular-nums
                                     text-muted-foreground">
                      {p.rank}.
                    </span>
                    <span className="flex-1 min-w-0 text-[11px] font-bold tracking-wide truncate
                                     text-foreground">
                      {p.name}
                    </span>
                    {soi && (
                      <span className="text-[9px] tracking-widest shrink-0 text-muted-foreground">
                        {N.t('relais_top_toi')}
                      </span>
                    )}
                    <span className={`font-mono text-[10px] tabular-nums shrink-0
                      ${choisi ? 'text-emerald-300' : 'text-muted-foreground'}`}>
                      {chrono(p.ms)}
                    </span>
                    {choisi && <Check className="w-3.5 h-3.5 shrink-0 text-emerald-300" />}
                  </button>
                );
              })}
            </div>
          )}

          {caches > 0 && (
            <p className="text-[9px] text-center text-muted-foreground">
              {N.t('relais_top_reste', { n: String(caches) })}
            </p>
          )}

          {/* Dit une fois pour toutes pourquoi les lignes ne repondent plus,
              au lieu de laisser croire a une liste cassee. */}
          {complet && liste !== null && (
            <p className="text-[9px] text-center text-muted-foreground leading-snug">
              {N.t('relais_top_pleines')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
