import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Swords, Check, X, Loader2 } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { fetchDuels, cleDiscipline } from '@/game/duels';
import { fetchLeaderboard, getSavedName, estEpreuveIndividuelle } from '@/game/leaderboard';
import { useRetour } from '@/hooks/use-retour';
import { epreuvesDuJeu, nomCourt } from '@/game/jeux';

/** Toutes les epreuves individuelles des jeux : on defie n'importe qui, vu sur n'importe laquelle. */
const TOUTES = [...new Set([...epreuvesDuJeu('sprinter'), ...epreuvesDuJeu('hurdlers')])]
  .filter(k => estEpreuveIndividuelle(k)) as string[];

/** Un adversaire choisi. `scoreId` quand il vient du TOP 500 ; un nom seul vient des duels. */
export type CibleDefi = { name: string; scoreId?: number };

export const MAX_CIBLES_DEFI = 50; // meme plafond que le worker

const cle = (n: string) => n.trim().toLowerCase();

/**
 * CHOISIR QUI DEFIER — plusieurs a la fois (09/11).
 *
 * Les deux classements au meme endroit, une case a cocher par ligne : on y
 * vient pour une seule question, « a qui j'envoie ce chrono ». Le serveur pose
 * le meme code chez chacun ; les duels n'ont pas d'identifiant de score, il
 * retrouve ces joueurs par leur nom.
 *
 * Par un portail : l'ecran de fin a des cadres flous, et un `backdrop-filter`
 * enferme les descendants en `position: fixed` (meme piege que LivePanel).
 */
export function ChoixAdversaires({ epreuves, initial, onValider, onClose }: {
  epreuves: string[];
  initial: CibleDefi[];
  onValider: (cibles: CibleDefi[]) => void;
  onClose: () => void;
}) {
  useRetour(onClose);
  const { N } = SprinterApp;
  const [onglet, setOnglet] = useState<'duels' | 'top'>('duels');
  const [choix, setChoix] = useState<Map<string, CibleDefi>>(
    () => new Map(initial.map(c => [cle(c.name), c])));
  const [filtre, setFiltre] = useState('');
  const [duels, setDuels] = useState<string[] | null>(null);
  const [top, setTop] = useState<CibleDefi[] | null>(null);
  const moi = cle(getSavedName() || '');
  // l'epreuve dont on lit les classements ; le defi, lui, reste sur la course courue
  const [vue, setVue] = useState(() => TOUTES.includes(epreuves[0]) ? epreuves[0] : (TOUTES[0] || epreuves[0]));

  useEffect(() => {
    let annule = false;
    setDuels(null); setTop(null);
    fetchDuels(cleDiscipline([vue]), false)
      .then(b => { if (!annule) setDuels((b?.classement || []).map(r => r.name)); })
      .catch(() => { if (!annule) setDuels([]); });
    const course = vue;
    if (estEpreuveIndividuelle(course)) {
      fetchLeaderboard(course)
        .then(l => {
          if (!annule) setTop(l.filter(e => e.id != null).map(e => ({ name: e.name, scoreId: e.id })));
        })
        .catch(() => { if (!annule) setTop([]); });
    } else setTop([]);
    return () => { annule = true; };
  }, [vue]);

  const lignes: CibleDefi[] | null = onglet === 'duels'
    ? (duels ? duels.map(name => ({ name })) : null)
    : top;

  const visibles = useMemo(() => {
    const f = cle(filtre);
    const vus = new Set<string>();
    return (lignes || []).filter(l => {
      const k = cle(l.name);
      if (!k || k === moi || vus.has(k)) return false;
      vus.add(k);
      return !f || k.includes(f);
    });
  }, [lignes, filtre, moi]);

  // Un nom tape qui n'est dans aucune liste : on le prend tel quel, le serveur
  // le retrouve par son appareil ou son dernier chrono, quelle que soit l'epreuve.
  const libre = filtre.trim();
  const nomLibre = libre && cle(libre) !== moi && !visibles.some(l => cle(l.name) === cle(libre))
    && !choix.has(cle(libre)) ? libre.slice(0, 20) : '';
  const plein = choix.size >= MAX_CIBLES_DEFI;
  const basculer = (l: CibleDefi) => {
    setChoix(m => {
      const n = new Map(m);
      const k = cle(l.name);
      if (n.has(k)) n.delete(k);
      else if (n.size < MAX_CIBLES_DEFI) n.set(k, l);
      return n;
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/85 backdrop-blur-sm flex flex-col items-center pointer-events-auto
                    px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                    pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="w-full max-w-lg mx-auto flex flex-col gap-3 h-full py-2">
        <div className="flex items-center gap-2">
          <Swords className="w-5 h-5 text-primary shrink-0" />
          <h2 className="flex-1 font-black font-display tracking-tight text-primary text-lg md:text-xl">
            {N.t('defi_choisir')}
          </h2>
          <button onClick={onClose} aria-label="Fermer"
                  className="w-9 h-9 rounded-xl flex items-center justify-center border border-white/10 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-2" role="tablist">
          {(['duels', 'top'] as const).map(o => (
            <button key={o} role="tab" aria-selected={onglet === o} onClick={() => setOnglet(o)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold tracking-widest border transition-colors
                      ${onglet === o ? 'bg-primary text-background border-primary' : 'border-white/10 text-muted-foreground'}`}>
              {N.t(o === 'duels' ? 'defi_onglet_duels' : 'defi_onglet_top')}
            </button>
          ))}
        </div>

        {TOUTES.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1">
            {TOUTES.map(k => (
              <button key={k} onClick={() => setVue(k)} aria-pressed={vue === k}
                      className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider border transition-colors
                        ${vue === k ? 'bg-primary/20 text-primary border-primary/60' : 'border-white/10 text-muted-foreground'}`}>
                {nomCourt(k)}
              </button>
            ))}
          </div>
        )}

        <input value={filtre} onChange={e => setFiltre(e.target.value)} placeholder={N.t('defi_chercher')}
               className="w-full bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50" />

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain flex flex-col gap-1.5 pr-1">
          {lignes === null && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto my-6" />}
          {nomLibre && (
            <button onClick={() => { basculer({ name: nomLibre }); setFiltre(''); }} disabled={plein}
                    className="flex items-center gap-3 px-3 py-2 rounded-xl border border-dashed border-primary/40 text-left text-sm disabled:opacity-40">
              <Swords className="w-4 h-4 shrink-0 text-primary" />
              <span className="flex-1 min-w-0 truncate">{N.t('defi_ajouter_nom', { n: nomLibre })}</span>
            </button>
          )}
          {lignes !== null && visibles.length === 0 && !nomLibre && (
            <p className="text-center text-sm text-muted-foreground py-6">{N.t('defi_vide')}</p>
          )}
          {visibles.map((l, i) => {
            const pris = choix.has(cle(l.name));
            return (
              <button key={cle(l.name)} onClick={() => basculer(l)} disabled={!pris && plein}
                      role="checkbox" aria-checked={pris}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl border text-left transition-colors disabled:opacity-40
                        ${pris ? 'bg-primary/15 border-primary/40' : 'border-white/5 bg-black/20'}`}>
                <span className="w-7 shrink-0 text-xs font-bold text-muted-foreground">{i + 1}.</span>
                <span className="flex-1 min-w-0 truncate text-sm font-bold">{l.name}</span>
                <span className={`w-5 h-5 shrink-0 rounded-md border flex items-center justify-center
                  ${pris ? 'bg-primary border-primary text-background' : 'border-white/30'}`}>
                  {pris && <Check className="w-3.5 h-3.5" />}
                </span>
              </button>
            );
          })}
        </div>

        {plein && <p className="text-center text-[10px] text-amber-300/90">{N.t('defi_max', { n: MAX_CIBLES_DEFI })}</p>}
        <button onClick={() => { onValider([...choix.values()]); onClose(); }}
                className="w-full py-3 rounded-xl font-black font-display tracking-widest text-sm text-background bg-primary hover:bg-primary/90">
          {N.t('defi_valider', { n: choix.size })}
        </button>
      </div>
    </div>,
    document.body,
  );
}
