import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { useChampDirect } from '@/game/champ-direct';
import {
  FAMILLES, EMOJIS, texteRapide, estEmoji, envoyerRapide, couperRapide,
  ouvrirChoixRapide, useTchatRapide, type Bulle,
} from '@/game/tchat-rapide';
import { VOILE, FEUILLE, SURGISSEMENT } from '@/lib/mouvement';

/**
 * Le tchat rapide, par-dessus la salle de course (voir game/tchat-rapide.ts).
 *
 * Il vit ici, a la racine, et non dans le salon ou la tribune : la salle
 * survit au changement d'ecran — le salon disparait au coup de pistolet, la
 * tribune a la fin de la course — et les bulles doivent survivre avec elle.
 *
 * Deux regles de place, parce que ce qui passe par-dessus une course ne doit
 * jamais la gener :
 * - les bulles ne prennent aucun appui (`pointer-events: none`) : elles
 *   s'affichent a gauche, sous le bouton de pause, et les pouces qui
 *   martelent l'ecran passent au travers ;
 * - le bouton disparait pour celui qui court. Un coureur a besoin de tout
 *   l'ecran pour ses deux touches ; il le retrouve a l'arrivee, et en
 *   tribune s'il a pris un carton.
 *
 * Le bouton flottant ne sert qu'au direct du championnat, dont les ecrans
 * centrent leur panneau et laissent le coin libre. Le salon du direct, lui,
 * est un panneau de l'accueil, plein jusqu'au bord : le bouton y aurait mordu
 * sur JE SUIS PRET. Il y porte donc le sien (LivePanel), qui ouvre le meme
 * choix.
 */
export function TchatRapide() {
  const { N } = SprinterApp;
  const t = useTchatRapide();
  const state = useGameStore(s => s.state);
  const champ = useChampDirect();
  const ouvert = t.choix;
  const setOuvert = (v: boolean) => ouvrirChoixRapide(v);
  const [, setTic] = useState(0);

  // L'attente apres un envoi se termine d'elle-meme : on redessine a la fin.
  const reste = t.attenteJusqua - Date.now();
  useEffect(() => {
    if (reste <= 0) return;
    const m = setTimeout(() => setTic(v => v + 1), reste + 20);
    return () => clearTimeout(m);
  }, [reste]);

  const enCourse = state === 'count' || state === 'race';
  const spectateur = !!SprinterApp.G?.spectateur
    || (champ.ouvert && champ.role === 'spectateur');
  const peutParler = t.actif && !(enCourse && !spectateur);
  const bouton = peutParler && champ.ouvert;

  // Le choix ouvert se referme si la course part sous lui.
  useEffect(() => { if (!peutParler && ouvert) ouvrirChoixRapide(false); }, [peutParler, ouvert]);

  if (!t.actif) return null;

  const attend = reste > 0;
  const envoyer = (q: string) => {
    if (envoyerRapide(q)) setOuvert(false);
  };

  return (
    <>
      {/* LES BULLES. */}
      <div
        className="fixed z-40 pointer-events-none flex flex-col items-start gap-1.5"
        style={{
          left: 'calc(max(env(safe-area-inset-left), 0.5rem))',
          top: 'calc(max(env(safe-area-inset-top), 0.5rem) + 7rem)',
          maxWidth: 'min(78vw, 22rem)',
        }}
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {t.bulles.map(b => <BulleRapide key={b.cle} b={b} tribune={N.t('rapide_tribune')} />)}
        </AnimatePresence>
      </div>

      {/* LE BOUTON. */}
      <AnimatePresence>
        {bouton && !ouvert && (
          <motion.button
            {...SURGISSEMENT}
            onClick={() => setOuvert(true)}
            aria-label={N.t('rapide_ouvrir')}
            className="fixed z-40 pointer-events-auto rounded-full w-11 h-11
                       bg-black/45 hover:bg-black/60 active:bg-black/70
                       border border-white/15 backdrop-blur-sm shadow-lg
                       flex items-center justify-center"
            style={{
              right: 'calc(max(env(safe-area-inset-right), 0.75rem))',
              bottom: 'calc(max(env(safe-area-inset-bottom), 0.75rem) + 0.25rem)',
            }}
          >
            <IconeRapide className="w-5 h-5 text-primary" />
          </motion.button>
        )}
      </AnimatePresence>

      {/* LE CHOIX DES PHRASES. */}
      <AnimatePresence>
        {ouvert && peutParler && (
          <motion.div
            {...VOILE}
            className="fixed inset-0 z-[57] pointer-events-auto bg-black/40 flex items-end justify-center"
            onClick={() => setOuvert(false)}
          >
            <motion.div
              {...FEUILLE}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md bg-card/95 border border-white/10 rounded-t-2xl
                         shadow-2xl px-4 pt-3 overflow-y-auto"
              style={{
                paddingBottom: 'calc(max(env(safe-area-inset-bottom), 0.75rem) + 0.25rem)',
                maxHeight: 'min(78dvh, 34rem)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="font-black font-display tracking-widest text-primary text-sm">
                  {N.t('rapide_ouvrir').toUpperCase()}
                </span>
                <span className="flex items-center gap-2">
                  {attend && (
                    <span className="text-[11px] text-muted-foreground italic">{N.t('rapide_attends')}</span>
                  )}
                  <button
                    onClick={() => setOuvert(false)}
                    aria-label={N.t('rapide_fermer')}
                    className="w-8 h-8 rounded-full flex items-center justify-center
                               text-muted-foreground hover:text-foreground bg-secondary/60"
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor"
                         strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </span>
              </div>

              <div className="grid grid-cols-8 gap-1 mb-3">
                {Object.keys(EMOJIS).map(q => (
                  <button
                    key={q}
                    disabled={attend}
                    onClick={() => envoyer(q)}
                    className="h-10 rounded-xl bg-secondary/60 hover:bg-secondary active:scale-95
                               text-xl flex items-center justify-center transition
                               disabled:opacity-40"
                  >
                    {EMOJIS[q]}
                  </button>
                ))}
              </div>

              {FAMILLES.map(f => (
                <div key={f.cle} className="mb-3">
                  <div className="text-[10px] font-bold tracking-[0.2em] text-muted-foreground mb-1.5">
                    {N.t('rapide_' + f.cle)}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {f.ids.map(q => (
                      <button
                        key={q}
                        disabled={attend}
                        onClick={() => envoyer(q)}
                        className={`min-h-10 px-2.5 py-2 rounded-xl text-left leading-tight transition
                                    bg-secondary/60 hover:bg-secondary active:scale-[0.97]
                                    disabled:opacity-40 ${f.cle === 'arcade'
                                      ? 'font-black font-display italic tracking-wider text-primary text-sm'
                                      : 'font-semibold text-foreground text-[13px]'}`}
                      >
                        {texteRapide(q)}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <button
                onClick={() => couperRapide(!t.coupe)}
                className="w-full py-2 mb-1 rounded-xl text-xs font-bold tracking-widest
                           text-muted-foreground hover:text-foreground bg-secondary/40"
              >
                {N.t(t.coupe ? 'rapide_remettre' : 'rapide_couper')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

/** La bulle du tchat rapide, pour les deux boutons qui l'ouvrent. */
export function IconeRapide({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none"
         stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
         strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v10H9l-5 4V5z" />
      <path d="M8 9h8M8 12h5" />
    </svg>
  );
}

function BulleRapide({ b, tribune }: { b: Bulle; tribune: string }) {
  const emoji = estEmoji(b.q);
  const arcade = b.q.startsWith('a_');
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: -14, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8 }}
      transition={{ duration: 0.22 }}
      className={`rounded-2xl rounded-tl-md px-3 py-1.5 backdrop-blur-sm shadow-lg
                  bg-black/60 border ${b.moi ? 'border-primary/50' : 'border-white/10'}`}
    >
      <div className="text-[10px] font-black font-display tracking-wider uppercase text-primary/90 leading-tight truncate">
        {b.nom || tribune}
      </div>
      <div className={emoji ? 'text-2xl leading-none'
        : arcade ? 'font-black font-display italic tracking-wider text-primary text-base leading-tight'
        : 'font-semibold text-white text-sm leading-snug'}>
        {texteRapide(b.q)}
      </div>
    </motion.div>
  );
}
