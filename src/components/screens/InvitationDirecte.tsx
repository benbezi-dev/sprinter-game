import React, { useEffect, useRef, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { TRANSITION } from '@/lib/mouvement';
import { Radio, X } from 'lucide-react';
import { mesInvitations, trancher, type InvitationRecue } from '@/game/invitations-directes';
import { demanderRejoindre } from '@/game/salon-direct';
import { useSondageAuRepos, estAuCalme } from '@/hooks/use-sondage';
import { surCourrier } from '@/game/boite';

/**
 * Quelqu'un vous invite a courir, maintenant.
 *
 * Distinct de la boite aux defis, et il faut dire pourquoi : un defi differe
 * attend qu'on ait le temps, une invitation en direct attend qu'on soit LA.
 * Les deux ne se lisent donc pas au meme rythme et ne vieillissent pas
 * pareil — une pastille discrete qui pulse convient au premier, elle ferait
 * rater le second.
 *
 * D'ou les trois differences :
 *   - le sondage est court (cinq secondes) la ou les defis se relevent toutes
 *     les vingt ;
 *   - l'invitation porte un DECOMPTE, parce qu'elle expire vraiment : la
 *     salle sera fermee et l'hote parti ;
 *   - elle se referme d'elle-meme a l'expiration, sans qu'on ait rien a
 *     toucher. Une proposition perimee qui reste affichee ment.
 *
 * Comme la boite aux defis, elle ne parait qu'au repos : au milieu d'un 400 m,
 * une invitation qui s'ouvre est une course perdue.
 */
export function InvitationDirecte() {
  const { N } = SprinterApp;
  const [invitations, setInvitations] = useState<InvitationRecue[]>([]);
  const annule = useRef(false);
  useEffect(() => { annule.current = false; return () => { annule.current = true; }; }, []);

  const interroger = useRef(() => {});
  interroger.current = () => {
    mesInvitations().then(l => { if (!annule.current) setInvitations(l); });
  };

  // Cinq secondes, et sans attendre quand la boite sonne. Le sondage reste
  // derriere la sonnerie pour les moments ou la liaison est tombee — c'est
  // exactement l'instant ou une invitation ne doit pas se perdre.
  useSondageAuRepos(() => interroger.current(), 5000);
  useEffect(() => surCourrier(quoi => {
    if (quoi === 'direct') interroger.current();
  }), []);

  // Le decompte. Il ne sert pas a decorer : il dit combien de temps il reste
  // pour se decider, et il ferme la carte quand il n'en reste plus.
  const [maintenant, setMaintenant] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setMaintenant(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const recuLe = useRef<Map<number, number>>(new Map());
  for (const i of invitations) {
    if (!recuLe.current.has(i.id)) recuLe.current.set(i.id, Date.now());
  }
  const resteDe = (i: InvitationRecue) => {
    const t0 = recuLe.current.get(i.id) ?? Date.now();
    return Math.max(0, i.reste_ms - (maintenant - t0));
  };

  const vivantes = invitations.filter(i => resteDe(i) > 0);
  if (!estAuCalme() || vivantes.length === 0) return null;

  // La plus recente, et elle seule. Deux invitations empilees dans un coin de
  // l'ecran ne se lisent pas : on prend la derniere arrivee, les autres
  // restent en attente derriere.
  const inv = vivantes[0];
  const reste = Math.ceil(resteDe(inv) / 1000);

  const rejoindre = () => {
    trancher(inv.id);
    setInvitations(l => l.filter(x => x.id !== inv.id));
    // Le panneau du direct sait rejoindre ; nous, non. On depose la demande,
    // il la ramasse — qu'il soit deja monte ou qu'il arrive apres.
    demanderRejoindre(inv.code);
  };

  const plusTard = () => {
    trancher(inv.id);
    setInvitations(l => l.filter(x => x.id !== inv.id));
  };

  return (
    <AnimatePresence>
      <motion.div
        key={inv.id}
        initial={{ opacity: 0, y: -14 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -14 }}
        className="fixed z-[59] left-1/2 -translate-x-1/2 top-3 md:top-4 w-[min(92vw,26rem)]
                   rounded-2xl border border-emerald-400/40 bg-[#0B0F19]/95 backdrop-blur
                   shadow-[0_2px_32px_rgba(0,0,0,0.45)] px-4 py-3 flex items-center gap-3"
      >
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={TRANSITION.battement}
          className="shrink-0 w-8 h-8 rounded-full bg-emerald-400/15 border border-emerald-400/40
                     flex items-center justify-center text-emerald-300"
        >
          <Radio className="w-4 h-4" />
        </motion.span>

        <div className="min-w-0 flex-1">
          <p className="text-xs md:text-sm font-bold text-foreground truncate">
            {N.t('live_invit_recue', { n: inv.de })}
          </p>
          <p className="text-[10px] md:text-xs text-muted-foreground font-mono">
            {inv.epreuve ? `${inv.epreuve} m · ` : ''}{reste} s
          </p>
        </div>

        <button
          onClick={rejoindre}
          className="shrink-0 px-3 py-1.5 rounded-xl font-black font-display tracking-widest
                     text-[10px] md:text-xs text-background bg-emerald-400
                     hover:bg-emerald-300 transition-colors"
        >
          {N.t('live_invit_ok')}
        </button>
        <button
          onClick={plusTard}
          aria-label={N.t('live_invit_non')}
          title={N.t('live_invit_non')}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                     text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  );
}
