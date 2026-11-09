import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings } from 'lucide-react';
import { SprinterApp, useGameStore, toggleLang, toggleAudio, HAS_VIBRATION } from '@/game/engine';
import { vibrationActive, poserVibration } from '@/game/reglages';
import { gererConsentement } from '@/game/pub';
import { EST_NATIF } from '@/game/canal';
import { VOILE, PANNEAU } from '@/lib/mouvement';

/** Un interrupteur on/off, lisible au pouce. */
function Interrupteur({ on, onClick, label, disabled }: { on: boolean; onClick: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label}
            disabled={disabled} onClick={onClick}
            className={`relative w-14 h-8 rounded-full transition-colors shrink-0 disabled:opacity-40
                        ${on ? 'bg-primary' : 'bg-secondary'}`}>
      <span className={`absolute top-1 w-6 h-6 rounded-full bg-background transition-all
                        ${on ? 'left-7' : 'left-1'}`} />
    </button>
  );
}

function Ligne({ titre, note, children }: { titre: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="w-full flex items-center justify-between gap-3 py-2.5 border-b border-white/10 last:border-0">
      <div className="min-w-0">
        <div className="font-bold text-sm text-foreground/90">{titre}</div>
        {note && <div className="text-[10px] text-muted-foreground">{note}</div>}
      </div>
      {children}
    </div>
  );
}

/**
 * La roue dentee de l'accueil et la fenetre qu'elle ouvre : son, vibration,
 * langue, consentement pub et liens legaux, au meme endroit.
 */
/** Ouvre la fenetre des parametres depuis un autre ecran (le profil). */
export const OUVRIR_PARAMETRES = 'sprinter:parametres';

export function Parametres() {
  const [ouvert, setOuvert] = useState(false);
  useEffect(() => {
    const ouvrir = () => setOuvert(true);
    window.addEventListener(OUVRIR_PARAMETRES, ouvrir);
    return () => window.removeEventListener(OUVRIR_PARAMETRES, ouvrir);
  }, []);
  const [vibre, setVibre] = useState(vibrationActive);
  const { N, Audio_ } = SprinterApp;
  useGameStore(() => Audio_.on);
  useGameStore(() => N.getLang());

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)} aria-label={N.t('reg_titre')}
              className="bg-card/80 backdrop-blur-md border border-white/10 p-2 md:p-3 rounded-xl hover:bg-white/10 transition-colors">
        <Settings className="w-4 h-4 md:w-5 md:h-5 text-foreground/90" />
      </button>

      <AnimatePresence>
        {ouvert && (
          <motion.div {...VOILE} onClick={() => setOuvert(false)}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto
                       px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
            <motion.div {...PANNEAU} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
              className="w-full max-w-xs max-h-[90dvh] overflow-y-auto bg-card/95 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col items-center gap-3">
              <h2 className="font-black font-display tracking-tight text-primary text-xl text-center">
                {N.t('reg_titre')}
              </h2>

              <div className="w-full">
                <Ligne titre={N.t('reg_son')}>
                  <Interrupteur on={Audio_.on} onClick={toggleAudio} label={N.t('reg_son')} />
                </Ligne>
                <Ligne titre={N.t('reg_vibration')} note={HAS_VIBRATION ? undefined : N.t('reg_sans_vibreur')}>
                  <Interrupteur on={HAS_VIBRATION && vibre} disabled={!HAS_VIBRATION} label={N.t('reg_vibration')}
                                onClick={() => { poserVibration(!vibre); setVibre(!vibre); }} />
                </Ligne>
                <Ligne titre={N.t('reg_langue')}>
                  <div className="flex rounded-xl bg-secondary p-1 gap-1">
                    {N.LANGS.map((l: string) => (
                      <button key={l} type="button" aria-pressed={N.getLang() === l}
                              onClick={() => { if (N.getLang() !== l) toggleLang(); }}
                              className={`px-3 py-1 rounded-lg text-xs font-bold transition-colors
                                          ${N.getLang() === l ? 'bg-primary text-background' : 'text-muted-foreground'}`}>
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </Ligne>
              </div>

              {EST_NATIF && (
                <button type="button" onClick={() => { void gererConsentement(); }}
                        className="w-full py-2.5 rounded-xl font-bold text-sm text-foreground/90 bg-secondary/60 hover:bg-secondary transition-colors">
                  {N.t('reg_pub')}
                </button>
              )}

              <div className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <a href="https://sprinter-game.com/conditions.html" target="_blank" rel="noopener noreferrer" className="py-1 hover:text-foreground">{N.t('legal_conditions')}</a>
                <a href="https://sprinter-game.com/confidentialite.html" target="_blank" rel="noopener noreferrer" className="py-1 hover:text-foreground">{N.t('legal_vie_privee')}</a>
                <a href="https://sprinter-game.com/suppression.html" target="_blank" rel="noopener noreferrer" className="py-1 hover:text-foreground">{N.t('legal_suppression')}</a>
              </div>

              <button type="button" onClick={() => setOuvert(false)}
                      className="w-full py-3 rounded-xl font-black font-display text-lg tracking-widest text-background bg-primary hover:bg-primary/90
                                 transition-all border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1">
                {N.t('close')}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
