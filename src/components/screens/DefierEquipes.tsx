import React, { useEffect, useRef, useState } from 'react';
import { Loader2, Search, Swords, Check } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import {
  annuaireRelais, lancerDefi,
  type EquipeAnnuaire, type EquipeRelais,
} from '@/game/relais';
import { MAX_EQUIPES } from '@/game/salle-confrontation';
import { entrerSurLaPiste } from '@/game/piste';

/**
 * Defier des equipes deja formees, en direct.
 *
 * La confrontation par code demandait de connaitre les autres equipes et de
 * leur passer le code hors du jeu. Ici on les trouve dans le jeu — toutes les
 * equipes au complet, celles dont un coureur est en ligne d'abord — et on en
 * coche jusqu'a sept : la piste a huit couloirs, le premier est a soi.
 *
 * Le serveur ouvre la confrontation et sonne chez chaque titulaire engage, mes
 * trois coequipiers compris. Le lanceur, lui, entre tout de suite sur la piste.
 */

const chrono = (ms: number) => (ms / 1000).toFixed(2) + ' s';
const MAX_DEFIEES = MAX_EQUIPES - 1;

export function DefierEquipes({ equipes }: { equipes: EquipeRelais[] }) {
  const { N } = SprinterApp;
  const [mienne, setMienne] = useState(equipes[0]?.id || '');
  const [q, setQ] = useState('');
  const [liste, setListe] = useState<EquipeAnnuaire[] | null>(null);
  const [choisies, setChoisies] = useState<string[]>([]);
  const [occupe, setOccupe] = useState(false);
  const [erreur, setErreur] = useState('');
  /** La derniere recherche partie : une reponse plus ancienne ne l'ecrase pas. */
  const tour = useRef(0);
  /** Les equipes cochees restent connues meme quand la recherche les masque. */
  const connues = useRef(new Map<string, EquipeAnnuaire>());

  useEffect(() => {
    const n = ++tour.current;
    const t = setTimeout(() => {
      annuaireRelais(q.trim()).then(r => {
        if (n !== tour.current) return;
        const l = r?.equipes || [];
        for (const e of l) connues.current.set(e.id, e);
        setListe(l);
      });
    }, q ? 300 : 0);
    return () => clearTimeout(t);
  }, [q]);

  const equipe = equipes.find(e => e.id === mienne) || equipes[0] || null;
  // Une equipe ou court l'un de mes coequipiers ne peut pas m'affronter : il
  // ne tient pas deux couloirs. Le serveur la refuserait ; on ne la propose pas.
  const nosCles = new Set((equipe?.membres || []).filter(m => m.etat === 'in').map(m => m.cle));
  const jouables = (liste || []).filter(e => !e.membres.some(m => nosCles.has(m.cle)));

  const basculer = (id: string) => {
    setErreur('');
    setChoisies(c => c.includes(id) ? c.filter(x => x !== id)
      : c.length >= MAX_DEFIEES ? c : [...c, id]);
  };

  const lancer = async () => {
    if (!equipe || !choisies.length) return;
    setOccupe(true); setErreur('');
    const r = await lancerDefi(equipe.id, choisies);
    setOccupe(false);
    if (!r || r.error || !r.id) { setErreur(r?.error === 'reseau' ? N.t('challenge_net') : (r?.error || N.t('challenge_net'))); return; }
    setChoisies([]);
    entrerSurLaPiste({
      genre: 'confrontation', code: r.id, equipe: equipe.id,
      max: r.max || 1 + choisies.length, fantomes: [],
    });
  };

  if (!equipes.length) return null;

  // Les cochees en tete, meme si la recherche courante ne les ramene plus.
  const cochees = choisies.map(id => connues.current.get(id)).filter(Boolean) as EquipeAnnuaire[];
  const affichees = [...cochees, ...jouables.filter(e => !choisies.includes(e.id))];

  return (
    <div className="flex flex-col gap-2.5 pt-1 border-t border-white/8">
      <span className="flex items-center gap-1.5 text-[9px] tracking-widest text-primary">
        <Swords className="w-3 h-3" /> {N.t('defier_titre')}
      </span>
      <p className="text-[10px] text-muted-foreground leading-snug">{N.t('defier_desc')}</p>

      {equipes.length > 1 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[9px] tracking-widest text-muted-foreground">{N.t('defier_avec')}</span>
          {equipes.map(e => (
            <button key={e.id} onClick={() => { setMienne(e.id); setChoisies([]); }}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-bold tracking-wide border
                ${e.id === equipe?.id ? 'border-primary/50 bg-primary/15 text-primary'
                                       : 'border-white/10 bg-black/25 text-muted-foreground'}`}>
              {e.nom}
            </button>
          ))}
        </div>
      )}

      <label className="flex items-center gap-2 bg-black/30 border border-white/10 rounded-xl px-3 py-2
                        focus-within:border-primary/50">
        <Search className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
        <input value={q} maxLength={24} onChange={ev => setQ(ev.target.value)}
          placeholder={N.t('defier_chercher')}
          className="flex-1 min-w-0 bg-transparent text-sm text-foreground
                     placeholder:text-muted-foreground focus:outline-none" />
      </label>

      {liste === null ? (
        <div className="flex justify-center py-3">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
        </div>
      ) : affichees.length === 0 ? (
        <p className="text-[10px] text-center text-muted-foreground py-2">
          {N.t(q.trim() ? 'defier_rien' : 'defier_aucune')}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-0.5">
          {affichees.map(e => {
            const pris = choisies.includes(e.id);
            const bloque = !pris && choisies.length >= MAX_DEFIEES;
            return (
              <button key={e.id} onClick={() => basculer(e.id)} disabled={bloque}
                aria-pressed={pris}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border text-left
                  transition-colors disabled:opacity-35
                  ${pris ? 'border-primary/50 bg-primary/[0.12]' : 'border-white/10 bg-black/25'}`}>
                <span className={`shrink-0 w-4 h-4 rounded-md border flex items-center justify-center
                  ${pris ? 'border-primary bg-primary text-background' : 'border-white/25'}`}>
                  {pris && <Check className="w-3 h-3" />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-bold tracking-wide truncate text-foreground">{e.nom}</span>
                    {e.en_ligne > 0 && (
                      <span className="shrink-0 flex items-center gap-1 text-[9px] text-emerald-300">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        {N.t('defier_en_ligne', { n: String(e.en_ligne) })}
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] text-muted-foreground truncate">
                    {e.membres.map(m => m.nom).join(' · ')}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                  {e.meilleur_ms != null ? chrono(e.meilleur_ms) : '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[9px] text-center text-muted-foreground tabular-nums">
        {N.t('defier_choisies', { n: String(choisies.length), m: String(1 + choisies.length) })}
      </p>
      <button onClick={lancer} disabled={occupe || !choisies.length || !equipe}
        className="w-full py-2.5 rounded-xl font-black font-display tracking-widest
                   text-background bg-primary hover:bg-primary/90 disabled:opacity-40
                   flex items-center justify-center gap-2">
        {occupe && <Loader2 className="w-4 h-4 animate-spin" />}
        {N.t('defier_lancer')}
      </button>
      {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
    </div>
  );
}
