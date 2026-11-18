import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LifeBuoy } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { VOILE, PANNEAU } from '@/lib/mouvement';
import { saveName } from '@/game/leaderboard';
import { etatRecuperation, recuperationEnAttente } from '@/game/identity';
import { useSondageAuRepos } from '@/hooks/use-sondage';
import { useRetour } from '@/hooks/use-retour';

/**
 * La reponse a une demande de recuperation, a l'ouverture du jeu.
 *
 * Le joueur qui a perdu son nom depose sa demande puis ferme le jeu : personne
 * ne reste devant le bouton VERIFIER. Cet appareil se souvient du nom demande
 * (identity.ts) et pose la question a chaque retour au calme ; c'est cette
 * lecture qui relie l'appareil et rend le code, comme le bouton. Le serveur
 * sonne aussi l'appareil a l'acceptation, quand il est abonne aux
 * notifications — ce panneau couvre ceux qui ne le sont pas.
 */
export function RecuperationRendue() {
  const { N } = SprinterApp;
  const [avis, setAvis] = useState<{ ok: boolean; nom: string } | null>(null);

  useSondageAuRepos(() => {
    const nom = recuperationEnAttente();
    if (!nom) return;
    etatRecuperation(nom).then(r => {
      if (r.etat === 'rendu') { saveName(r.name); setAvis({ ok: true, nom: r.name }); }
      if (r.etat === 'refuse') setAvis({ ok: false, nom });
    });
  }, 60000);

  const fermer = () => setAvis(null);
  useRetour(fermer, !!avis);

  return (
    <AnimatePresence>
      {avis && (
        <motion.div
          {...VOILE}
          onClick={fermer}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 pointer-events-auto
                     px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
        >
          <motion.div
            {...PANNEAU}
            onClick={e => e.stopPropagation()}
            role="dialog" aria-modal="true" aria-labelledby="rec-avis-titre"
            className="w-full max-w-sm bg-black rounded-2xl border border-white/15 p-6 flex flex-col gap-4"
          >
            <div className={`flex items-center gap-2 justify-center ${avis.ok ? 'text-primary' : 'text-destructive'}`}>
              <LifeBuoy className="w-4 h-4 shrink-0" />
              <h2 id="rec-avis-titre" className="font-bold font-display tracking-tight text-lg md:text-xl text-center">
                {N.t(avis.ok ? 'rec_avis_ok_title' : 'rec_avis_refus_title')}
              </h2>
            </div>
            <p className="text-sm leading-relaxed text-muted-foreground text-center">
              {N.t(avis.ok ? 'rec_avis_ok' : 'rec_avis_refus', { n: avis.nom })}
            </p>
            <button
              onClick={fermer}
              className="w-full py-2.5 rounded-xl font-bold tracking-widest text-sm text-background
                         bg-primary hover:bg-primary/90 transition-colors"
            >
              {N.t('annonce_ok')}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
