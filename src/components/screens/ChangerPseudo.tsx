import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { PencilLine, Loader2, Clock } from 'lucide-react';
import {
  demanderPseudo, lireEtatPseudo, pseudoValide, DEMANDE_PSEUDO_EVT,
  type EtatDemande, type ResultatDemande,
} from '@/game/pseudo';

/**
 * Demander un autre pseudo. Rien ne change tout de suite : la demande est
 * validee a la main (worker/src/pseudo-demandes.js), et le jeu apprend la
 * reponse a sa prochaine ouverture — ou par une notification.
 */
export function ChangerPseudo() {
  const { N } = SprinterApp;
  const [demande, setDemande] = useState<EtatDemande | null>(null);
  const [voulu, setVoulu] = useState('');
  const [etat, setEtat] = useState<'repos' | 'envoi' | ResultatDemande['etat']>('repos');

  useEffect(() => {
    const suivre = (e: Event) => setDemande((e as CustomEvent).detail || null);
    window.addEventListener(DEMANDE_PSEUDO_EVT, suivre);
    void lireEtatPseudo();
    return () => window.removeEventListener(DEMANDE_PSEUDO_EVT, suivre);
  }, []);

  const enAttente = demande?.statut === 'PENDING';

  const envoyer = async () => {
    const n = voulu.trim();
    if (!n || enAttente) return;
    if (!pseudoValide(n)) { setEtat('interdit'); return; }
    setEtat('envoi');
    const r = await demanderPseudo(n);
    setEtat(r.etat);
    if (r.etat === 'envoyee') {
      setVoulu('');
      setDemande({ statut: 'PENDING', demande: n, cree_le: Date.now(), resolu_le: null });
    }
  };

  const erreur: Record<string, string> = {
    interdit: 'pseudo_interdit', pris: 'pseudo_bloque_pris', en_cours: 'pseudo_changer_en_cours',
    invalide: 'pseudo_changer_invalide', meme: 'pseudo_changer_meme', erreur: 'pseudo_bloque_erreur',
  };

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-muted-foreground flex items-center gap-1.5">
        <PencilLine className="w-3 h-3" /> {N.t('pseudo_changer_titre')}
      </span>
      {enAttente ? (
        <p className="text-[11px] text-primary leading-snug flex items-center gap-1.5">
          <Clock className="w-3 h-3 shrink-0" /> {N.t('pseudo_changer_attente', { nom: demande!.demande })}
        </p>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              value={voulu}
              onChange={e => { setVoulu(e.target.value); setEtat('repos'); }}
              placeholder={N.t('your_name')}
              maxLength={20}
              className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm
                         text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />
            <button
              onClick={envoyer}
              disabled={!voulu.trim() || etat === 'envoi'}
              className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-foreground
                         bg-white/10 hover:bg-white/15 disabled:opacity-40 disabled:pointer-events-none
                         transition-colors flex items-center gap-2"
            >
              {etat === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {N.t('pseudo_changer_bouton')}
            </button>
          </div>
          {erreur[etat] && <p className="text-[11px] text-red-300 leading-snug">{N.t(erreur[etat])}</p>}
          {demande?.statut === 'REJECTED' && etat === 'repos' && (
            <p className="text-[10px] text-muted-foreground leading-snug">
              {N.t('pseudo_changer_refuse', { nom: demande.demande })}
            </p>
          )}
          {demande?.statut === 'EXPIRED' && etat === 'repos' && (
            <p className="text-[10px] text-muted-foreground leading-snug">
              {N.t('pseudo_changer_expire', { nom: demande.demande })}
            </p>
          )}
          <p className="text-[9px] md:text-[10px] text-muted-foreground/80 leading-snug">
            {N.t('pseudo_changer_note')}
          </p>
        </>
      )}
    </div>
  );
}
