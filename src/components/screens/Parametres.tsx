import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Check, Loader2 } from 'lucide-react';
import { SprinterApp, useGameStore, toggleLang, toggleAudio, HAS_VIBRATION } from '@/game/engine';
import { vibrationActive, poserVibration } from '@/game/reglages';
import { gererConsentement } from '@/game/pub';
import { sansPubs, prixSansPubs, acheterSansPubs, restaurerAchats, boutiquePossible, SANS_PUBS_CHANGE } from '@/game/achats';
import { EST_NATIF } from '@/game/canal';
import { tousLesBloques, debloquer } from '@/game/moderation';
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
/** L'offre « Sans pubs » : prix du store, achat, restauration (appli seulement). */
function BlocSansPubs() {
  const { N } = SprinterApp;
  const [acquis, setAcquis] = useState(sansPubs);
  const [prix, setPrix] = useState<string | null>(null);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'rien'>('repos');
  useEffect(() => {
    void prixSansPubs().then(setPrix);
    const relire = () => setAcquis(sansPubs());
    window.addEventListener(SANS_PUBS_CHANGE, relire);
    return () => window.removeEventListener(SANS_PUBS_CHANGE, relire);
  }, []);
  const acheter = async () => { setEtat('envoi'); await acheterSansPubs(); setEtat('repos'); };
  const restaurer = async () => { setEtat('envoi'); setEtat((await restaurerAchats()) ? 'repos' : 'rien'); };
  // Produit inconnu du store (pas encore cree, store injoignable) : rien a vendre, on ne montre rien.
  if (!acquis && !prix) return null;

  return (
    <div className="w-full flex flex-col gap-1.5 rounded-xl bg-secondary/50 px-3 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-bold text-sm text-foreground/90">{N.t('sp_titre')}</div>
          <div className="text-[10px] text-muted-foreground leading-snug">{N.t('sp_note')}</div>
        </div>
        {acquis ? (
          <span className="shrink-0 flex items-center gap-1 text-xs font-bold text-primary"><Check className="w-4 h-4" />{N.t('sp_acquis')}</span>
        ) : (
          <button type="button" onClick={acheter} disabled={!prix || etat === 'envoi'}
                  className="shrink-0 min-w-[4.5rem] flex items-center justify-center rounded-lg bg-primary text-background px-3 py-1.5 text-sm font-black disabled:opacity-50">
            {etat === 'envoi' ? <Loader2 className="w-4 h-4 animate-spin" /> : (prix || N.t('sp_indispo'))}
          </button>
        )}
      </div>
      {!acquis && (
        <button type="button" onClick={restaurer} disabled={etat === 'envoi'}
                className="self-start text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground">
          {etat === 'rien' ? N.t('sp_restaure_rien') : N.t('sp_restaurer')}
        </button>
      )}
    </div>
  );
}

/** Les joueurs bloques, avec de quoi revenir sur un blocage. Rien a montrer : rien. */
function BlocBloques() {
  const { N } = SprinterApp;
  const [noms, setNoms] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState<string | null>(null);
  useEffect(() => { void tousLesBloques().then(setNoms); }, []);
  if (!noms.length) return null;
  const lever = async (nom: string) => {
    setEnvoi(nom);
    await debloquer(nom);
    setNoms(l => l.filter(n => n !== nom));
    setEnvoi(null);
  };

  return (
    <div className="w-full flex flex-col gap-1.5 rounded-xl bg-secondary/50 px-3 py-2.5">
      <div>
        <div className="font-bold text-sm text-foreground/90">{N.t('reg_bloques')}</div>
        <div className="text-[10px] text-muted-foreground leading-snug">{N.t('reg_bloques_note')}</div>
      </div>
      {noms.map(nom => (
        <div key={nom} className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-sm text-foreground/80">{nom}</span>
          <button type="button" onClick={() => void lever(nom)} disabled={envoi !== null}
                  className="shrink-0 min-w-[5.5rem] flex items-center justify-center rounded-lg border border-white/15 px-3 py-1.5 text-xs font-bold text-foreground/90 hover:bg-white/10 disabled:opacity-50">
            {envoi === nom ? <Loader2 className="w-4 h-4 animate-spin" /> : N.t('reg_debloquer')}
          </button>
        </div>
      ))}
    </div>
  );
}

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

              {boutiquePossible() && <BlocSansPubs />}

              <BlocBloques />

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
