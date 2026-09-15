import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { VOILE, PANNEAU, TRANSITION } from '@/lib/mouvement';
import { Mail } from 'lucide-react';
import {
  fetchAnnonce, annonceVue, marquerAnnonceVue, prendreDemandeOuverture, type Annonce,
} from '@/game/annonce';
import { useSondageAuRepos, estAuCalme } from '@/hooks/use-sondage';
import { surCourrier } from '@/game/boite';

/**
 * Un message ecrit a la main a tous les joueurs.
 *
 * Il arrive comme un defi recu — une pastille en haut a droite, au repos
 * seulement — mais il ne doit pas en avoir le ton. Un defi est une
 * provocation, et le jaune du jeu le dit ; une annonce explique quelque chose,
 * souvent a quelqu'un qui vient de perdre son compte. D'ou un fond noir et un
 * bleu pale : rien qui ressemble a une alerte, rien qui presse.
 *
 * Toucher la notification du telephone ouvre le message directement, sans
 * passer par la pastille.
 */

/** Le bleu de l'annonce : un ciel doux, lisible sur le noir, sans rien d'une
 *  alerte. Plus pale, il passait pour du blanc. */
const BLEU = '#86B6E3';
const BLEU_DOUX = '#A7C8E8';

export function AnnoncePopup() {
  const { state } = useGameStore();     // re-rendu au changement d'ecran
  const { N } = SprinterApp;

  const [annonce, setAnnonce] = useState<Annonce | null>(null);
  const [ouvert, setOuvert] = useState(false);

  const annule = useRef(false);
  useEffect(() => { annule.current = false; return () => { annule.current = true; }; }, []);

  const interroger = useRef((ouvrir: boolean) => {});
  interroger.current = (ouvrir: boolean) => {
    fetchAnnonce().then(a => {
      if (annule.current || !a) return;
      setAnnonce(a);
      if (ouvrir && !annonceVue(a.id)) setOuvert(true);
    });
  };

  // Une minute suffit : une annonce n'a rien d'urgent. La boite, elle, sonne
  // dans la seconde pour ceux qui ont le jeu ouvert au moment de l'envoi. Le
  // premier passage ouvre le message si c'est un toucher de notification qui
  // vient de lancer le jeu.
  useSondageAuRepos(() => interroger.current(prendreDemandeOuverture()), 60000);

  // Le jeu lance par la notification passe d'abord par le generique, ou l'on
  // n'interroge pas : sans ceci, le message attendait le battement suivant,
  // jusqu'a une minute apres l'arrivee sur l'accueil. On demande donc au
  // premier ecran calme — et a chaque retour au calme tant qu'un toucher de
  // notification attend sa reponse.
  const premier = useRef(true);
  useEffect(() => {
    if (!estAuCalme()) return;
    const demande = prendreDemandeOuverture();
    if (demande || premier.current) { premier.current = false; interroger.current(demande); }
  }, [state]);

  // 'annonce_dispo' : la boite sonne, la pastille apparait. 'annonce' : on
  // vient de toucher la notification (push.ts relaie son genre), le message
  // s'ouvre.
  useEffect(() => surCourrier(quoi => {
    if (quoi === 'annonce_dispo') interroger.current(false);
    if (quoi === 'annonce') interroger.current(prendreDemandeOuverture());
  }), []);

  if (!annonce || annonceVue(annonce.id) || !estAuCalme()) return null;

  const fermer = () => {
    marquerAnnonceVue(annonce.id);
    setOuvert(false);
    setAnnonce(a => (a ? { ...a } : a));  // la pastille disparait avec
  };

  return (
    <>
      {!ouvert && (
        <motion.button
          onClick={() => setOuvert(true)}
          animate={{ opacity: [1, 0.7, 1] }}
          transition={TRANSITION.battement}
          className="fixed z-[58] pointer-events-auto flex items-center gap-2
                     rounded-full bg-black font-bold border
                     text-[10px] md:text-xs tracking-widest uppercase px-3 py-2"
          style={{
            color: BLEU, borderColor: 'rgba(169,201,230,0.45)',
            right: 'calc(max(env(safe-area-inset-right), 0.75rem))',
            // Sous la pastille des defis, pour que les deux tiennent ensemble.
            top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 6.2rem)',
          }}
        >
          <Mail className="w-3.5 h-3.5" />
          {N.t('annonce_pastille')}
        </motion.button>
      )}

      <AnimatePresence>
        {ouvert && (
          <motion.div
            {...VOILE}
            onClick={fermer}
            className="fixed inset-0 z-[59] flex items-center justify-center bg-black/85
                       pointer-events-auto
                       px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
          >
            <motion.div
              {...PANNEAU}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-sm bg-black rounded-2xl border p-6
                         flex flex-col gap-4 max-h-[80dvh] overflow-y-auto"
              style={{ borderColor: 'rgba(169,201,230,0.25)' }}
            >
              <div className="flex items-center gap-2 justify-center" style={{ color: BLEU }}>
                <Mail className="w-4 h-4 shrink-0" />
                <h2 className="font-bold font-display tracking-tight text-lg md:text-xl text-center">
                  {annonce.titre}
                </h2>
              </div>

              <p className="text-sm leading-relaxed whitespace-pre-line" style={{ color: BLEU_DOUX }}>
                {annonce.texte}
              </p>

              <button
                onClick={fermer}
                className="w-full py-2.5 rounded-xl font-bold tracking-widest text-sm
                           border transition-colors hover:bg-white/5"
                style={{ color: BLEU, borderColor: 'rgba(169,201,230,0.4)' }}
              >
                {N.t('annonce_ok')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
