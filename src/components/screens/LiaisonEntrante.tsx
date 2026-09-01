import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Loader2, Check, LinkIcon } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { saveName } from '@/game/leaderboard';
import { jetonDepuisUrl, oublierJetonUrl, utiliserTransfert, type LiaisonResult } from '@/game/identity';

/**
 * L'arrivee par un lien de liaison.
 *
 * Le telephone vient de viser un QR code affiche par un appareil deja relie.
 * Il n'y a rien a demander au joueur : le jeton EST la preuve, et le seul
 * geste qu'on lui doit est de lui dire sous quel nom il vient d'atterrir.
 *
 * Le jeton est retire de l'adresse des qu'il est presente. Sans cela, un
 * simple rechargement rejouerait la liaison et afficherait « ce lien a deja
 * servi » a quelqu'un qui n'a rien fait de mal.
 */
export function LiaisonEntrante() {
  const { N } = SprinterApp;
  const [jeton] = useState(jetonDepuisUrl);
  const [res, setRes] = useState<LiaisonResult | null>(null);

  useEffect(() => {
    if (!jeton) return;
    oublierJetonUrl();
    let vivant = true;
    utiliserTransfert(jeton).then(r => {
      if (!vivant) return;
      if (r.etat === 'lie') saveName(r.name);
      setRes(r);
    });
    return () => { vivant = false; };
  }, [jeton]);

  if (!jeton) return null;

  const message =
    !res ? null
    : res.etat === 'lie' ? N.t('id_linked', { n: res.name })
    : res.etat === 'deja_utilise' ? N.t('id_link_used')
    : res.etat === 'perime' ? N.t('id_link_expired')
    : res.etat === 'inconnu' ? N.t('id_link_bad')
    : N.t('score_save_fail');

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-6 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-xs rounded-2xl border border-white/10 bg-card/90 p-5
                   flex flex-col items-center gap-3 shadow-2xl"
      >
        {!res ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-[10px] font-bold tracking-widest text-muted-foreground">
              {N.t('id_linking')}
            </span>
          </>
        ) : (
          <>
            {res.etat === 'lie'
              ? <Check className="w-6 h-6 text-primary" />
              : <LinkIcon className="w-6 h-6 text-destructive" />}
            <span className={`text-xs font-bold text-center ${res.etat === 'lie' ? 'text-primary' : 'text-destructive'}`}>
              {message}
            </span>
            <button
              onClick={() => window.location.reload()}
              className="mt-1 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                         bg-primary hover:bg-primary/90 transition-colors"
            >
              {N.t('champ_continue')}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
