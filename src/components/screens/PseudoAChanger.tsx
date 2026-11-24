import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { ShieldAlert, Loader2 } from 'lucide-react';
import {
  pseudoAChanger, pseudoValide, verifierNomGarde, installerGardePseudo,
  changerPseudoForce, lireEtatPseudo, raisonChangement, PSEUDO_A_CHANGER_EVT,
} from '@/game/pseudo';

/**
 * L'ecran bloquant d'un pseudo interdit.
 *
 * Il ne se ferme pas : ni croix, ni clic a cote, ni touche Echap. La seule
 * sortie est un pseudo propre — le serveur refuserait de toute facon chaque
 * course (`USERNAME_CHANGE_REQUIRED`), et un ecran fermable ne ferait que
 * repousser le refus a la ligne de depart.
 *
 * Le changement passe par `/pseudo/forcer` : le joueur garde ses chronos et sa
 * progression, et n'attend aucune validation — on ne fait pas patienter
 * quelqu'un a qui l'on interdit de jouer.
 */
export function PseudoAChanger() {
  const { N } = SprinterApp;
  const [ouvert, setOuvert] = useState(!!pseudoAChanger());
  const [nom, setNom] = useState('');
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'interdit' | 'pris' | 'erreur'>('repos');

  useEffect(() => {
    installerGardePseudo();
    const suivre = () => setOuvert(!!pseudoAChanger());
    window.addEventListener(PSEUDO_A_CHANGER_EVT, suivre);
    verifierNomGarde();
    void lireEtatPseudo();
    suivre();
    return () => window.removeEventListener(PSEUDO_A_CHANGER_EVT, suivre);
  }, []);

  if (!ouvert) return null;
  const { raison, ancien } = raisonChangement();

  const valider = async () => {
    const n = nom.trim();
    if (!n) return;
    if (!pseudoValide(n)) { setEtat('interdit'); return; }
    setEtat('envoi');
    const r = await changerPseudoForce(n);
    if (r === 'ok') { setNom(''); setEtat('repos'); }
    else setEtat(r);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4"
         role="alertdialog" aria-modal="true" aria-labelledby="pseudo-bloque-titre">
      <div className="w-full max-w-sm bg-card border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-primary" />
          <h2 id="pseudo-bloque-titre" className="text-xs font-bold tracking-widest text-primary">
            {N.t('pseudo_bloque_titre')}
          </h2>
        </div>
        <p className="text-sm text-foreground leading-snug">
          {raison === 'libere'
            ? N.t('pseudo_libere_texte', { ancien: ancien || '' })
            : N.t('pseudo_bloque_texte')}
        </p>
        <p className="text-[11px] text-muted-foreground leading-snug">{N.t('pseudo_bloque_garde')}</p>
        <input
          value={nom}
          autoFocus
          onChange={e => { setNom(e.target.value); setEtat('repos'); }}
          onKeyDown={e => { if (e.key === 'Enter') void valider(); }}
          placeholder={N.t('your_name')}
          maxLength={20}
          className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm text-foreground
                     placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        {etat === 'interdit' && <p className="text-[11px] text-red-300 leading-snug">{N.t('pseudo_interdit')}</p>}
        {etat === 'pris' && <p className="text-[11px] text-red-300 leading-snug">{N.t('pseudo_bloque_pris')}</p>}
        {etat === 'erreur' && <p className="text-[11px] text-red-300 leading-snug">{N.t('pseudo_bloque_erreur')}</p>}
        <button
          onClick={valider}
          disabled={!nom.trim() || etat === 'envoi'}
          className="px-4 py-2.5 rounded-xl font-bold tracking-wide text-xs text-background bg-primary
                     hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none transition-colors
                     flex items-center justify-center gap-2"
        >
          {etat === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {N.t('pseudo_bloque_valider')}
        </button>
      </div>
    </div>
  );
}
