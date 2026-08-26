import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'framer-motion';
import { Swords, Loader2 } from 'lucide-react';
import { fetchInbox, fetchChallenge, type InboxChallenge } from '@/game/challenge';

/** On ne derange pas un joueur en pleine course. */
const CALME = new Set(['title', 'result', 'winall', 'over']);

/**
 * Defi recu.
 *
 * Le pastillage clignote pour se faire remarquer sans occuper l'ecran : on
 * peut l'ignorer et continuer a jouer. Il n'apparait qu'au repos — au milieu
 * d'un 400 m, une invitation qui pulse serait une nuisance, pas une nouvelle.
 */
export function InboxPopup() {
  const { state } = useGameStore();
  const { N } = SprinterApp;

  const [defis, setDefis] = useState<InboxChallenge[]>([]);
  const [ouvert, setOuvert] = useState(false);
  const [chargement, setChargement] = useState('');
  const vu = useRef<Set<string>>(new Set());

  // On interroge au repos, puis de loin en loin : un defi differe n'a pas
  // besoin d'arriver a la seconde.
  useEffect(() => {
    let annule = false;
    const relever = () => {
      if (!CALME.has(SprinterApp.G.state)) return;
      fetchInbox().then(list => { if (!annule) setDefis(list); });
    };
    relever();
    const id = setInterval(relever, 45000);
    return () => { annule = true; clearInterval(id); };
  }, []);

  const enAttente = defis.filter(d => !vu.current.has(d.id));
  if (!CALME.has(state) || enAttente.length === 0) return null;

  const relever = async (d: InboxChallenge) => {
    setChargement(d.id);
    try {
      const ch = await fetchChallenge(d.id);
      if (!ch) { vu.current.add(d.id); setDefis(x => [...x]); return; }
      setOuvert(false);
      SprinterApp.startOneShot(ch.races, {
        levelIdx: ch.level_idx,
        ghosts: ch.traces,
        ghostSplits: ch.splits.map(ms => ms / 1000),
        ghostName: ch.owner_name,
        ghostTime: ch.total_ms / 1000,
        challenge: { id: ch.id, owner_name: ch.owner_name, total_ms: ch.total_ms },
      });
    } catch {
      // reseau muet : le defi reste dans la boite, on reessaiera
    } finally {
      setChargement('');
    }
  };

  return (
    <>
      {/* Pastille clignotante, discrete, en haut a droite */}
      {!ouvert && (
        <motion.button
          onClick={() => setOuvert(true)}
          animate={{ opacity: [1, 0.45, 1], scale: [1, 1.06, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
          className="fixed z-[58] pointer-events-auto flex items-center gap-2
                     rounded-full bg-primary text-background font-bold
                     text-[10px] md:text-xs tracking-widest uppercase
                     px-3 py-2 shadow-[0_0_24px_rgba(248,205,74,0.55)]"
          style={{
            right: 'calc(max(env(safe-area-inset-right), 0.75rem))',
            top: 'calc(max(env(safe-area-inset-top), 0.75rem) + 3.4rem)',
          }}
        >
          <Swords className="w-3.5 h-3.5" />
          {enAttente.length > 1
            ? N.t('inbox_many', { n: enAttente.length })
            : N.t('inbox_one')}
        </motion.button>
      )}

      <AnimatePresence>
        {ouvert && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[59] flex items-center justify-center bg-black/80
                       backdrop-blur-md pointer-events-auto
                       px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]"
          >
            <motion.div
              initial={{ scale: 0.94, y: 10 }} animate={{ scale: 1, y: 0 }}
              className="w-full max-w-sm bg-card/95 border border-primary/30 rounded-2xl
                         p-5 shadow-2xl flex flex-col gap-3 max-h-[80dvh] overflow-y-auto"
            >
              <div className="flex items-center gap-2 justify-center">
                <Swords className="w-4 h-4 text-primary" />
                <h2 className="font-black font-display tracking-tight text-primary text-lg md:text-xl">
                  {enAttente.length > 1
                    ? N.t('inbox_many', { n: enAttente.length })
                    : N.t('inbox_one')}
                </h2>
              </div>

              {enAttente.map(d => (
                <div key={d.id} className="rounded-xl border border-white/10 bg-black/30 p-3 flex flex-col gap-2">
                  <p className="text-xs md:text-sm text-foreground text-center">
                    {N.t('inbox_from', {
                      n: d.owner_name,
                      d: d.races.join(' + '),
                      s: (d.total_ms / 1000).toFixed(2),
                    })}
                  </p>
                  <button
                    onClick={() => relever(d)}
                    disabled={chargement === d.id}
                    className="w-full py-2.5 rounded-xl font-black font-display tracking-widest
                               text-background bg-primary hover:bg-primary/90 disabled:opacity-50
                               transition-colors flex items-center justify-center gap-2"
                  >
                    {chargement === d.id && <Loader2 className="w-4 h-4 animate-spin" />}
                    {N.t('inbox_accept')}
                  </button>
                </div>
              ))}

              <button
                onClick={() => setOuvert(false)}
                className="text-[10px] md:text-xs text-muted-foreground hover:text-foreground
                           tracking-widest uppercase py-1 transition-colors"
              >
                {N.t('inbox_later')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
