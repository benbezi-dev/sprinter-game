import React, { useEffect, useState } from 'react';
import { Loader2, Ghost } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import {
  fantomesRelais, ouvrirConfrontation,
  type FantomeRelais, type EquipeRelais,
} from '@/game/relais';
import { MAX_EQUIPES } from '@/game/salle-confrontation';
import { entrerSurLaPiste } from '@/game/piste';

/**
 * Affronter les dix meilleures courses enregistrees.
 *
 * C'est la seule facon de courir contre les meilleures equipes du jeu sans
 * avoir a reunir huit personnes a la meme minute — et pour un relais, ou il
 * faut deja quatre presents pour exister, cela change tout.
 *
 * Un fantome n'obeit a aucune regle : il a deja couru, sa course est un fait.
 * Il ne peut donc etre ni elimine ni double a la transmission ; il rejoue, et
 * l'on court contre son chrono. On n'en garde que dix, parce qu'au-dela une
 * trace de quatre cents positions par course serait stockee pour des equipes
 * que plus personne n'ira defier.
 */

const chrono = (ms: number) => (ms / 1000).toFixed(2) + ' s';
/** Un couloir pour soi, sept pour les fantomes. */
const MAX_FANTOMES = MAX_EQUIPES - 1;

export function Fantomes({ equipes }: { equipes: EquipeRelais[] }) {
  const { N } = SprinterApp;
  const [liste, setListe] = useState<FantomeRelais[] | null>(null);
  const [choisis, setChoisis] = useState<number[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');

  useEffect(() => {
    fantomesRelais().then(r => setListe(r?.fantomes || []));
  }, []);

  const basculer = (id: number) => {
    setChoisis(c => c.includes(id) ? c.filter(x => x !== id)
      : c.length >= MAX_FANTOMES ? c : [...c, id]);
  };

  const lancer = async () => {
    const mienne = equipes[0];
    if (!mienne || !choisis.length) return;
    setOccupe(true); setErreur('');
    // Une confrontation contre des fantomes reste une confrontation : elle a
    // besoin d'un salon, meme si personne d'autre n'y entrera. Le code ne se
    // partage pas, il sert juste d'adresse.
    const r = await ouvrirConfrontation();
    setOccupe(false);
    if (!r || r.error || !r.id) { setErreur(N.t('challenge_net')); return; }
    entrerSurLaPiste({
      genre: 'confrontation', code: r.id, equipe: mienne.id,
      max: Math.min(MAX_EQUIPES, 1 + choisis.length),
      fantomes: choisis,
    });
  };

  if (!equipes.length) return null;

  return (
    <div className="flex flex-col gap-2.5 pt-1 border-t border-white/8">
      <span className="flex items-center gap-1.5 text-[9px] tracking-widest text-cyan-300">
        <Ghost className="w-3 h-3" /> {N.t('fantome_titre')}
      </span>
      <p className="text-[10px] text-muted-foreground leading-snug">
        {N.t('fantome_desc')}
      </p>

      {liste === null && (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      )}

      {liste !== null && liste.length === 0 && (
        <p className="text-[10px] text-center text-muted-foreground leading-snug">
          {N.t('fantome_aucun')}
        </p>
      )}

      {liste !== null && liste.length > 0 && (
        <div className="flex flex-col gap-1.5">
          {liste.map(f => {
            const pris = choisis.includes(f.id);
            const plein = !pris && choisis.length >= MAX_FANTOMES;
            return (
              <button key={f.id} onClick={() => basculer(f.id)} disabled={plein}
                aria-pressed={pris}
                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left
                  disabled:opacity-30
                  ${pris ? 'border-cyan-400/50 bg-cyan-400/[0.10]'
                         : 'border-white/8 bg-black/25'}`}>
                <span className="font-mono text-[10px] w-5 tabular-nums text-muted-foreground">
                  {f.rang}.
                </span>
                <span className="flex-1 min-w-0 text-[11px] font-bold tracking-wide truncate
                                 text-foreground">
                  {f.equipe}
                </span>
                <span className={`font-mono text-[10px] tabular-nums shrink-0
                  ${pris ? 'text-cyan-300' : 'text-muted-foreground'}`}>
                  {chrono(f.total_ms)}
                </span>
              </button>
            );
          })}

          <p className="text-[9px] text-center text-muted-foreground">
            {N.t('fantome_choisis', { n: String(choisis.length), m: String(MAX_FANTOMES) })}
          </p>
          <button onClick={lancer} disabled={occupe || !choisis.length}
            className="w-full py-2.5 rounded-xl font-black font-display tracking-widest
                       text-background bg-cyan-400 hover:bg-cyan-400/90 disabled:opacity-40
                       flex items-center justify-center gap-2">
            {occupe && <Loader2 className="w-4 h-4 animate-spin" />}
            {N.t('fantome_defier')}
          </button>
        </div>
      )}

      {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
    </div>
  );
}
