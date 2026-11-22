import React, { useEffect, useRef, useState } from 'react';
import { nomEnLigne } from '@/game/jeux';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { TRANSITION } from '@/lib/mouvement';
import { Radio, X } from 'lucide-react';
import { mesInvitations, trancher, type InvitationRecue } from '@/game/invitations-directes';
import { noterDefi } from '@/game/journal-defis';
import { demanderRejoindre, salonCourant, quitterSalon } from '@/game/salon-direct';
import { usePiste } from '@/game/piste';
import { toast } from '@/hooks/use-toast';
import { sonnerDefiDirect, clignoterOnglet, poserDirectVisible } from '@/game/sonnerie';
import { useSondageAuRepos, estAuCalme } from '@/hooks/use-sondage';
import { surCourrier } from '@/game/boite';
import { HALLOWEEN_OUVERT } from '@/game/canal';
import { demanderLaMeute } from '@/game/halloween-meute';
import { mot as motDeLaNuit } from '@/game/halloween-mots';

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
  // l'ecran : elle ne parait qu'au repos (estAuCalme), et doit partir au depart
  useGameStore(s => s.state);
  // Un relais se court sans changer l'etat du jeu : on ne sonne pas par-dessus.
  const piste = usePiste();
  /** Ce qu'il restait a la premiere vue : la barre se vide depuis la. */
  const dureeDe = useRef<Map<number, number>>(new Map());
  const [invitations, setInvitations] = useState<InvitationRecue[]>([]);
  const annule = useRef(false);
  useEffect(() => { annule.current = false; return () => { annule.current = true; }; }, []);

  /** L'heure de la derniere reponse du serveur, par invitation. */
  const recuLe = useRef<Map<number, number>>(new Map());
  const interroger = useRef(() => {});
  interroger.current = () => {
    mesInvitations().then(l => {
      if (annule.current) return;
      // `reste_ms` arrive deja diminue par le serveur : le decompte repart de
      // cette reponse-ci, sinon l'ecoule se retranche deux fois (21/10).
      const t = Date.now();
      for (const i of l) recuLe.current.set(i.id, t);
      setInvitations(l);
      // Une invitation en direct ne laissait rien derriere elle : elle expire
      // au bout de dix minutes, et celle qu'on rate pendant qu'on fait autre
      // chose disparaissait sans qu'on sache meme qu'elle avait existe. On
      // l'inscrit des l'arrivee, avec son heure d'expiration — le journal
      // saura tout seul, a la relecture, qu'elle a ete manquee.
      for (const i of l) {
        noterDefi({
          cle: `direct:${i.id}`, genre: 'direct', sens: 'recu', etat: 'attente',
          nom: i.de, epreuves: i.epreuve ? [String(i.epreuve)] : [], salle: i.code,
          expire: Date.now() + Math.max(0, i.reste_ms),
        });
      }
    });
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
  for (const i of invitations) {
    if (!recuLe.current.has(i.id)) recuLe.current.set(i.id, Date.now());
  }
  const resteDe = (i: InvitationRecue) => {
    const t0 = recuLe.current.get(i.id) ?? Date.now();
    return Math.max(0, i.reste_ms - (maintenant - t0));
  };

  const vivantes = invitations.filter(i => resteDe(i) > 0);
  // La plus recente, et elle seule. Deux invitations empilees dans un coin de
  // l'ecran ne se lisent pas : on prend la derniere arrivee, les autres
  // restent en attente derriere, et on dit combien.
  const inv = !piste && estAuCalme() ? vivantes[0] : undefined;

  // Une sonnerie a l'arrivee, un rappel vingt secondes apres, jamais davantage.
  const sonnees = useRef<Map<number, number>>(new Map());
  useEffect(() => {
    if (!inv) return;
    const id = inv.id;
    if (!sonnees.current.has(id)) { sonnees.current.set(id, 1); sonnerDefiDirect(); }
    if (sonnees.current.get(id)! >= 2) return;
    const rappel = setTimeout(() => { sonnees.current.set(id, 2); sonnerDefiDirect(); }, 20000);
    return () => clearTimeout(rappel);
  }, [inv?.id]);

  useEffect(() => {
    if (!inv) return;
    poserDirectVisible(true);
    const rendre = clignoterOnglet(`🔴 ${N.t('live_invit_titre')}`);
    return () => { poserDirectVisible(false); rendre(); };
  }, [inv?.id]);

  if (!inv) return null;
  const meute = String(inv.epreuve || '').startsWith('nuit-');
  const resteMs = resteDe(inv);
  // Une invitation renvoyee est prolongee : le total suit.
  const total = Math.max(resteMs, dureeDe.current.get(inv.id) ?? 0);
  dureeDe.current.set(inv.id, total);
  const part = resteMs / total;
  const reste = Math.ceil(resteMs / 1000);
  const autres = vivantes.length - 1;

  const rejoindre = () => {
    const versLaMeute = HALLOWEEN_OUVERT && meute;
    if (!versLaMeute) {
      // Le panneau ne quitte pas une salle pour une autre : on le dit AVANT de
      // trancher, sinon l'invitation serait consommee pour rien.
      const salle = salonCourant();
      if (salle && salle.code !== inv.code) {
        if (!salle.coupee || salle.enVie()) {
          toast({ title: N.t('live_invit_titre'), description: N.t('live_invit_occupe') });
          return;
        }
        quitterSalon();
      }
    }
    trancher(inv.id);
    noterDefi({
      cle: `direct:${inv.id}`, genre: 'direct', sens: 'recu', etat: 'releve',
      nom: inv.de, epreuves: inv.epreuve ? [String(inv.epreuve)] : [], salle: inv.code,
    });
    setInvitations(l => l.filter(x => x.id !== inv.id));
    // Le panneau du direct sait rejoindre ; nous, non. On depose la demande,
    // il la ramasse — qu'il soit deja monte ou qu'il arrive apres.
    // Une invitation dans une meute de la nuit du molosse ouvre SON salon :
    // c'est l'epreuve (un trace `nuit-*`) qui le dit.
    if (versLaMeute) { demanderLaMeute(inv.code); return; }
    // Le panneau ne vit qu'a l'accueil, dans l'onglet DEFI (voir TitleScreen).
    if (SprinterApp.G.state !== 'title') SprinterApp.goHome();
    demanderRejoindre(inv.code);
  };

  const plusTard = () => {
    trancher(inv.id);
    // Refusee est une forme de manquee : la personne a tendu la main, on n'y
    // est pas alle. Elle reste une semaine dans MES COURSES, avec de quoi la
    // redefier — c'est tout l'interet de la noter.
    noterDefi({
      cle: `direct:${inv.id}`, genre: 'direct', sens: 'recu', etat: 'manque',
      nom: inv.de, epreuves: inv.epreuve ? [String(inv.epreuve)] : [], salle: inv.code,
    });
    setInvitations(l => l.filter(x => x.id !== inv.id));
  };

  const epreuve = meute ? `${motDeLaNuit('hw_m_titre')} · ${motDeLaNuit('hw_titre')}`
    : inv.epreuve ? nomEnLigne(inv.epreuve) : '';

  // Le voile detache la carte du decor sans rien bloquer derriere elle.
  // Pas d'autoFocus : une touche tapee au meme instant accepterait l'invitation.
  return (
    <AnimatePresence>
      <motion.div
        key="voile"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-x-0 top-0 h-64 z-[69] pointer-events-none
                   bg-gradient-to-b from-black/80 to-transparent"
      />
      {/* Le centrage est a part : motion ecrase le translate de ce qu'il anime. */}
      <div key={inv.id} className="fixed z-[70] inset-x-0 flex justify-center pointer-events-none"
           style={{ top: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}>
        <motion.section
          aria-label={N.t('live_invit_titre')}
          initial={{ opacity: 0, y: -40, scale: 0.92 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="pointer-events-auto w-[min(94vw,30rem)] rounded-3xl overflow-hidden
                     border-2 border-emerald-400/70 bg-[#07130f]
                     shadow-[0_8px_48px_rgba(16,185,129,0.45)]"
        >
          <div className="px-4 pt-4 pb-3 flex items-center gap-3.5">
            <span className="relative shrink-0 w-12 h-12">
              <motion.span
                animate={{ scale: [1, 1.55], opacity: [0.6, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-emerald-400/50"
              />
              <span className="absolute inset-0 rounded-full bg-emerald-400 text-background
                               flex items-center justify-center">
                <Radio className="w-6 h-6" />
              </span>
            </span>

            <div className="min-w-0 flex-1">
              {/* L'alerte s'arrete avant le decompte : il serait relu chaque seconde. */}
              <div role="alert">
                <p className="text-[10px] md:text-xs font-black tracking-[0.2em] text-emerald-300
                              flex items-center gap-1.5">
                  <motion.span
                    animate={{ opacity: [1, 0.2, 1] }}
                    transition={TRANSITION.battement}
                    className="inline-block w-2 h-2 rounded-full bg-red-500"
                  />
                  {N.t('live_invit_titre')}
                </p>
                <p className="text-base md:text-lg font-black text-foreground leading-tight
                              line-clamp-2 break-words">
                  {N.t('live_invit_recue', { n: inv.de })}
                </p>
              </div>
              <p className="text-xs md:text-sm text-muted-foreground font-mono truncate">
                {epreuve ? `${epreuve} · ` : ''}
                {Math.floor(reste / 60)}:{String(reste % 60).padStart(2, '0')}
                {autres > 0 ? ` · ${N.t('live_invit_autres', { n: String(autres) })}` : ''}
              </p>
            </div>
          </div>

          <div className="px-4 pb-4 flex gap-2">
            <button
              onClick={rejoindre}
              className="flex-1 py-3 rounded-2xl font-black font-display tracking-widest
                         text-sm md:text-base text-background bg-emerald-400
                         hover:bg-emerald-300 transition-colors"
            >
              {N.t('live_invit_ok')}
            </button>
            <button
              onClick={plusTard}
              className="px-4 py-3 rounded-2xl font-bold tracking-wider text-xs md:text-sm
                         text-muted-foreground border border-white/15 hover:text-foreground
                         transition-colors flex items-center gap-1.5"
            >
              <X className="w-4 h-4" /> {N.t('live_invit_non')}
            </button>
          </div>

          <div aria-hidden className="h-1.5 bg-white/10">
            <div
              className={`h-full transition-[width] duration-1000 ease-linear
                ${part < 0.2 ? 'bg-red-500' : 'bg-emerald-400'}`}
              style={{ width: `${part * 100}%` }}
            />
          </div>
        </motion.section>
      </div>
    </AnimatePresence>
  );
}
