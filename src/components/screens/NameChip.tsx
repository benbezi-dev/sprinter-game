import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'framer-motion';
import { User, Check, Loader2, KeyRound, X } from 'lucide-react';
import { getSavedName, saveName } from '@/game/leaderboard';
import { claimName, savedCode } from '@/game/identity';

/**
 * Le nom du joueur, la ou tout le monde passe.
 *
 * Il etait demande uniquement a la fin d'une course, dans le bandeau de
 * record, et modifiable seulement au fond de TOP 500 > MES COURSES. Un joueur
 * qui ne bat aucun record ne se voyait donc jamais proposer de nom, et celui
 * qui voulait le changer devait le chercher trois ecrans plus loin. Resultat :
 * des chronos anonymes et des noms qui ne suivent pas d'un appareil a l'autre.
 *
 * Il vit desormais sur l'accueil, en evidence tant qu'il est vide.
 */
export function NameChip() {
  const { N } = SprinterApp;
  const etatJeu = useGameStore(s => s.state);
  const [nom, setNom] = useState(getSavedName());

  const [ouvert, setOuvert] = useState(false);
  const [saisie, setSaisie] = useState(nom);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'pris' | 'ok'>('repos');
  const [code, setCode] = useState(savedCode());

  // Le nom peut aussi etre pose ailleurs — au bandeau de record, a la fin
  // d'un one shot. On le relit en revenant a l'accueil, sinon la puce
  // afficherait encore « choisis ton nom » alors qu'il vient d'etre choisi.
  useEffect(() => { setNom(getSavedName()); setCode(savedCode()); }, [etatJeu]);

  useEffect(() => { if (ouvert) { setSaisie(getSavedName()); setEtat('repos'); } }, [ouvert]);

  const valider = async () => {
    const n = saisie.trim();
    if (n.length < 2) return;
    // On enregistre d'abord : le nom doit servir meme si le reseau est muet.
    saveName(n); setNom(n);
    setEtat('envoi');
    // Puis on tente de le reserver, ce qui donne le code de recuperation et
    // permet de retrouver ses courses sur un autre telephone.
    const r = await claimName(n);
    if (r.etat === 'reserve') { setCode(r.code); setEtat('ok'); }
    else if (r.etat === 'pris') setEtat('pris');
    else setEtat('ok');
    if (r.etat !== 'pris') setTimeout(() => setOuvert(false), 1200);
  };

  const vide = !nom;

  return (
    <>
      <button
        onClick={() => setOuvert(true)}
        className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl flex items-center gap-1.5 md:gap-2
                    border transition-colors max-w-[45vw]
          ${vide
            ? 'bg-primary/20 border-primary/60 text-primary animate-pulse'
            : 'bg-card/80 backdrop-blur-md border-white/10 hover:bg-white/10 text-foreground/90'}`}
      >
        <User className={`w-3.5 h-3.5 md:w-4 md:h-4 ${vide ? 'text-primary' : 'text-muted-foreground'}`} />
        <span className="font-bold text-xs md:text-sm truncate">
          {vide ? N.t('name_set') : nom}
        </span>
      </button>

      {ouvert && (
        <div className="fixed inset-0 z-[58] bg-black/85 backdrop-blur-sm flex items-center justify-center
                        pointer-events-auto p-4">
          <motion.div
            initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-sm bg-card/95 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] md:text-xs font-bold tracking-[0.25em] text-primary">
                {N.t('name_title')}
              </span>
              <button onClick={() => setOuvert(false)} className="p-1.5 rounded-lg hover:bg-white/10">
                <X className="w-4 h-4 opacity-70" />
              </button>
            </div>

            <p className="text-[10px] md:text-xs text-muted-foreground leading-snug">
              {N.t('name_why')}
            </p>

            <input
              value={saisie}
              onChange={e => { setSaisie(e.target.value); setEtat('repos'); }}
              onKeyDown={e => { if (e.key === 'Enter') valider(); }}
              placeholder={N.t('your_name')}
              maxLength={20}
              autoFocus
              className="bg-black/35 border border-white/10 rounded-xl px-3 py-2.5 text-base text-foreground
                         placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
            />

            {etat === 'pris' && (
              <p className="text-xs text-destructive">{N.t('name_taken')}</p>
            )}
            {etat === 'ok' && code && (
              <div className="rounded-xl border border-primary/30 bg-primary/[0.07] px-3 py-2 flex flex-col gap-1">
                <span className="text-[10px] font-bold tracking-widest text-primary flex items-center gap-1.5">
                  <KeyRound className="w-3 h-3" />{N.t('name_code')}
                </span>
                <span className="font-mono font-black tracking-[0.25em] text-primary text-lg">{code}</span>
                <span className="text-[9px] text-muted-foreground leading-snug">{N.t('name_code_why')}</span>
              </div>
            )}

            <button
              onClick={valider}
              disabled={saisie.trim().length < 2 || etat === 'envoi'}
              className="w-full py-3 rounded-xl font-black font-display tracking-widest text-background
                         bg-primary hover:bg-primary/90 disabled:opacity-40 transition-colors
                         flex items-center justify-center gap-2"
            >
              {etat === 'envoi' && <Loader2 className="w-4 h-4 animate-spin" />}
              {etat === 'ok' && <Check className="w-4 h-4" />}
              {N.t(etat === 'ok' ? 'name_saved' : 'name_save')}
            </button>
          </motion.div>
        </div>
      )}
    </>
  );
}
