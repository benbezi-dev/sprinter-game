import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, Check, X } from 'lucide-react';

import { SprinterApp, useGameStore } from '@/game/engine';
import { FEUILLE } from '@/lib/mouvement';
import { activerPush, etatPush } from '@/game/push';
import { installVisible } from './InstallPrompt';

const REPORTS = 'sprinter_notifs_reports';

/**
 * A-t-on deja couru ?
 *
 * Pose en dehors du composant parce que la reponse ne doit pas se perdre au
 * remontage, et qu'elle ne concerne que cette session : quelqu'un qui vient
 * d'ouvrir le jeu et regarde l'accueil n'a rien a se faire notifier — il n'a
 * defie personne. Une course finie, et la question a un sens.
 */
let aCouru = false;

/**
 * Combien de fois on repose la question a quelqu'un qui a repondu « plus
 * tard ».
 *
 * Trois, et pas une seule : « plus tard » n'est pas « non ». Quelqu'un qui
 * vient de finir sa premiere course n'a encore recu aucun defi et ne voit pas
 * de quoi on lui parle ; le meme, trois courses plus loin, en a lance et
 * attend une reponse. Trois, et pas indefiniment : au-dela, c'est un refus
 * qu'on n'ecoute pas.
 */
const REPORTS_MAX = 3;

function reports(): number {
  try { return Number(localStorage.getItem(REPORTS) || 0) || 0; } catch { return 0; }
}

/**
 * L'invitation a se laisser prevenir, avec un bouton — et c'est tout le sujet.
 *
 * LA PERMISSION NE S'OBTIENT QUE SOUS UN DOIGT. Le jeu la demandait depuis un
 * `useEffect`, au premier resultat de course : personne n'avait rien touche au
 * moment de l'appel, et une demande sans geste n'est pas traitee pareil selon
 * l'endroit. Chrome ouvre bien une fenetre, mais la degrade en une pastille
 * dans la barre d'adresse des qu'il flaire une demande spontanee — invisible
 * sur un telephone. Safari, lui, rejette carrement : sur iPhone, ou le jeu
 * ajoute a l'ecran d'accueil n'a que ce chemin-la, l'appel levait
 * `NotAllowedError`, la promesse etait rattrapee, et il ne se passait rien.
 *
 * Ce que cela donnait : 90 appareils connus du serveur, 3 abonnements — et les
 * trois poses a la main pendant une mise au point. Le serveur envoyait
 * parfaitement des notifications que personne ne s'etait jamais mis en
 * situation de recevoir.
 *
 * D'ou cette carte. Elle ne demande rien tant qu'on ne la touche pas, et ce
 * qu'elle demande part alors d'un `onClick` : la fenetre du systeme s'ouvre,
 * partout, pour de bon.
 *
 * QUAND. De retour a l'accueil, une course derriere soi. Pas sur l'ecran de
 * resultat, ou le code d'avant demandait : ce que le joueur y cherche est le
 * bouton ETAPE SUIVANTE, qui vit au bas d'un panneau qui defile — une carte
 * posee par-dessus le recouvrirait sur un ecran court. L'accueil est le seul
 * ecran de repos du jeu, c'est deja la que l'invitation a installer se pose,
 * et c'est de la qu'on part defier quelqu'un.
 */
export function InviteNotifs() {
  const { state } = useGameStore();
  const { N } = SprinterApp;

  const [ouvert, setOuvert] = useState(false);
  // La question a ete posee dans cette session : on ne la repose pas, quelle
  // qu'ait ete la reponse.
  const [pose, setPose] = useState(false);
  // Et elle a abouti : la carte le dit avant de s'effacer. Sans ce mot, le
  // bouton disparait et rien ne distingue « accorde » de « rate ».
  const [reussi, setReussi] = useState(false);

  // Le passage par un ecran d'arrivee se note dans un effet, pas dans le
  // rendu : React rejoue un rendu quand il veut, et un rendu qui laisse une
  // trace derriere lui est un rendu qu'on ne peut plus rejouer.
  useEffect(() => {
    if (state === 'result' || state === 'winall') aCouru = true;
  }, [state]);

  // L'accueil, et une course derriere soi.
  const bonMoment = state === 'title' && aCouru;

  useEffect(() => {
    if (!bonMoment || pose) return;
    if (reports() >= REPORTS_MAX) return;

    let vivant = true;
    let minuteur: ReturnType<typeof setTimeout> | undefined;

    const regarder = () => {
      if (!vivant) return;
      // L'invitation a installer occupe exactement ce bas d'ecran, et passe
      // avant. Ce n'est pas qu'une question de place : sur iPhone,
      // l'installation est un PREALABLE — `PushManager` n'existe pas dans un
      // onglet Safari, il n'apparait que dans le jeu ajoute a l'ecran
      // d'accueil, et proposer avant serait proposer un bouton sans effet.
      //
      // On repasse plutot qu'on ne regarde une fois : sur Android, la fenetre
      // d'installation n'arrive pas au chargement mais quand le navigateur
      // juge le jeu installable, parfois plusieurs secondes plus tard.
      if (installVisible()) { minuteur = setTimeout(regarder, 3000); return; }

      // `etatPush` ne demande rien et n'ouvre rien : elle lit ce que le
      // systeme dit deja. Une permission refusee ne se repose pas depuis une
      // page — la carte se tait alors plutot que de promettre un bouton sans
      // effet.
      etatPush().then(etat => {
        if (vivant && etat === 'a-demander') setOuvert(true);
      }).catch(() => { /* dans le doute, on ne propose pas */ });
    };
    regarder();

    return () => { vivant = false; if (minuteur) clearTimeout(minuteur); };
  }, [bonMoment, pose]);

  // Une course repart : la carte s'efface sans rien retenir. Ce n'est pas un
  // refus, c'est un joueur qui court.
  useEffect(() => {
    if (!bonMoment) setOuvert(false);
  }, [bonMoment]);

  const reporter = () => {
    setOuvert(false);
    setPose(true);
    try { localStorage.setItem(REPORTS, String(reports() + 1)); } catch { /* sans memoire */ }
  };

  /**
   * Le clic, et rien entre le clic et la demande.
   *
   * `activerPush` va droit a `Notification.requestPermission()` : aucun
   * `await` ne s'intercale avant, sans quoi le navigateur considererait le
   * geste consomme et refuserait d'ouvrir la fenetre.
   */
  const activer = async () => {
    const ok = await activerPush();
    setPose(true);
    if (!ok) { setOuvert(false); return; }   // refuse au systeme : on n'insiste pas
    setReussi(true);
    setTimeout(() => setOuvert(false), 2200);
  };

  if (!ouvert) return null;

  return (
    <AnimatePresence>
      <motion.div
        {...FEUILLE}
        className="fixed inset-x-0 bottom-0 z-[54] pointer-events-auto
                   px-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]
                   pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="mx-auto w-full max-w-md bg-card/95 backdrop-blur-md border border-primary/30
                        rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/15 border border-primary/30
                            flex items-center justify-center">
              {reussi ? <Check className="w-4 h-4 text-emerald-400" />
                    : <Bell className="w-4 h-4 text-primary" />}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">
                {N.t('notifs_title')}
              </h2>
              <p className="text-[10px] md:text-xs text-muted-foreground leading-snug mt-0.5">
                {reussi ? N.t('notifs_done') : N.t('notifs_why')}
              </p>
            </div>
            {!reussi && (
              <button onClick={reporter} aria-label={N.t('notifs_later')}
                      className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {!reussi && (
            <button
              onClick={activer}
              className="w-full py-3 rounded-xl font-black font-display text-lg tracking-widest
                         text-background bg-primary hover:bg-primary/90 transition-all
                         border-b-4 border-amber-600 active:border-b-0 active:translate-y-1"
            >
              {N.t('notifs_do')}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
