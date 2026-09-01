import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Check, Unlink } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { jetonDansUrl, nettoyerUrlJeton, utiliserTransfert } from '@/game/identity';

/**
 * Le telephone qui vient d'etre vise.
 *
 * Il arrive sur le jeu avec un jeton dans le fragment de l'adresse. On le
 * consomme tout de suite, avant que le joueur n'ait a chercher quoi que ce
 * soit : c'est le geste entier — viser, ouvrir, c'est fini.
 *
 * Le jeton est lu une seule fois, au montage, et retire de l'adresse dans la
 * foulee. Sans ce retrait, un rechargement de la page rejouerait la liaison
 * avec un jeton deja consomme, et le joueur verrait un echec la ou tout
 * s'etait bien passe.
 */
export function LiaisonParLien() {
  const { N } = SprinterApp;
  const [etat, setEtat] = useState<'rien' | 'envoi' | 'lie' | 'mort'>('rien');
  const [nom, setNom] = useState('');

  useEffect(() => {
    const jeton = jetonDansUrl();
    if (!jeton) return;
    nettoyerUrlJeton();
    setEtat('envoi');
    utiliserTransfert(jeton).then(r => {
      if (r.etat === 'lie') { setNom(r.name); setEtat('lie'); }
      else setEtat('mort');
    });
  }, []);

  // Une reussite se referme toute seule : le joueur voulait jouer, pas lire
  // une confirmation. Un echec reste, parce qu'il demande une decision.
  useEffect(() => {
    if (etat !== 'lie') return;
    const id = setTimeout(() => setEtat('rien'), 2600);
    return () => clearTimeout(id);
  }, [etat]);

  if (etat === 'rien') return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xs bg-card border border-white/10 rounded-2xl p-5
                   flex flex-col items-center gap-3 shadow-2xl"
      >
        {etat === 'envoi' && (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">{N.t('id_join_wait')}</span>
          </>
        )}
        {etat === 'lie' && (
          <>
            <Check className="w-6 h-6 text-primary" />
            <span className="text-sm font-bold text-primary text-center">
              {N.t('id_join_ok', { n: nom })}
            </span>
          </>
        )}
        {etat === 'mort' && (
          <>
            <Unlink className="w-6 h-6 text-destructive" />
            <span className="text-xs text-muted-foreground text-center leading-snug">
              {N.t('id_join_dead')}
            </span>
            <button
              onClick={() => setEtat('rien')}
              className="mt-1 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                         bg-primary hover:bg-primary/90 transition-colors"
            >
              {N.t('id_qr_close')}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
