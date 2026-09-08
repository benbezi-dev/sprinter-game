import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion, AnimatePresence } from 'motion/react';
import { FEUILLE } from '@/lib/mouvement';
import { Download, Share, Plus, X } from 'lucide-react';
import { EST_NATIF } from '@/game/canal';

const REFUS = 'sprinter_install_refuse';

/**
 * Cette invitation occupe-t-elle le bas de l'ecran en ce moment ?
 *
 * Une autre carte veut la meme place — celle des notifications — et doit
 * pouvoir attendre son tour. Un drapeau de module plutot qu'un contexte : la
 * question est « est-ce que la place est prise », pas « qu'est-ce qui la
 * prend », et une seule de ces cartes existe a la fois dans l'arbre.
 *
 * Le savoir compte sur Android en particulier : `beforeinstallprompt` n'arrive
 * pas au chargement mais quand le navigateur juge le jeu installable — parfois
 * plusieurs secondes apres. Regarder une seule fois ne suffit donc pas, et
 * c'est a celui qui attend de repasser.
 */
let visible = false;
export function installVisible(): boolean { return visible; }

/** Deja lance depuis l'ecran d'accueil du telephone ? */
function dejaInstalle() {
  // Dans l'enveloppe native, le jeu EST l'application : il n'y a rien a
  // installer, et proposer de passer par Safari renverrait vers un autre canal
  // de distribution — absurde pour le joueur, et refuse par l'App Store.
  if (EST_NATIF) return true;
  try {
    return window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true;
  } catch { return false; }
}

function estIOS() {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && (navigator as any).maxTouchPoints > 1);
}

/**
 * Invitation a installer le jeu sur le telephone.
 *
 * Les deux plateformes ne se ressemblent pas. Android previent par
 * beforeinstallprompt et laisse declencher l'installation depuis la page ;
 * Safari n'expose aucune API — l'ajout a l'ecran d'accueil s'y fait a la main,
 * on ne peut donc que montrer le chemin.
 *
 * On ne le propose qu'au repos, jamais pendant une course, et une seule fois :
 * un refus est retenu.
 */
export function InstallPrompt() {
  const { state } = useGameStore();
  const { N } = SprinterApp;

  const [invite, setInvite] = useState<any>(null);   // evenement Android
  const [ouvert, setOuvert] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (dejaInstalle()) return;
    try { if (localStorage.getItem(REFUS)) return; } catch { /* pas de memoire */ }

    // Android : le navigateur previent qu'il sait installer.
    const onInvite = (e: Event) => {
      e.preventDefault();
      setInvite(e);
      setOuvert(true);
    };
    window.addEventListener('beforeinstallprompt', onInvite);

    // iOS : rien ne previent, on montre le chemin — mais seulement dans
    // Safari, la ou le menu Partager existe reellement.
    if (estIOS() && /Safari/.test(navigator.userAgent) && !/CriOS|FxiOS/.test(navigator.userAgent)) {
      setIos(true);
      const t = setTimeout(() => setOuvert(true), 2500);
      return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', onInvite); };
    }
    return () => window.removeEventListener('beforeinstallprompt', onInvite);
  }, []);

  const refuser = () => {
    setOuvert(false);
    try { localStorage.setItem(REFUS, '1'); } catch { /* sans memoire, il reviendra */ }
  };

  const installer = async () => {
    if (!invite) return;
    setOuvert(false);
    try {
      invite.prompt();
      await invite.userChoice;
    } catch { /* refuse : rien a faire */ }
    setInvite(null);
    try { localStorage.setItem(REFUS, '1'); } catch { /* sans memoire */ }
  };

  // Jamais pendant une course : on n'interrompt pas un chrono.
  const montre = state === 'title' && ouvert;

  // Le drapeau se pose dans un effet, pas dans le rendu : un rendu qui laisse
  // une trace derriere lui est un rendu qu'on ne peut plus rejouer.
  useEffect(() => {
    visible = montre;
    return () => { visible = false; };
  }, [montre]);

  if (!montre) return null;

  return (
    <AnimatePresence>
      <motion.div
        {...FEUILLE}
        className="fixed inset-x-0 bottom-0 z-[57] pointer-events-auto
                   px-[max(env(safe-area-inset-left),0.75rem)] pr-[max(env(safe-area-inset-right),0.75rem)]
                   pb-[max(env(safe-area-inset-bottom),0.75rem)]"
      >
        <div className="mx-auto w-full max-w-md bg-card/95 backdrop-blur-md border border-primary/30
                        rounded-2xl p-4 shadow-2xl flex flex-col gap-3">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/15 border border-primary/30
                            flex items-center justify-center">
              <Download className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-bold tracking-widest text-primary text-xs md:text-sm">
                {N.t('install_title')}
              </h2>
              <p className="text-[10px] md:text-xs text-muted-foreground leading-snug mt-0.5">
                {N.t('install_why')}
              </p>
            </div>
            <button onClick={refuser} aria-label={N.t('install_later')}
                    className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {ios ? (
            /* Safari n'a pas d'API : on decrit le geste, avec ses icones. */
            <div className="flex items-center flex-wrap gap-1.5 text-[11px] md:text-xs text-foreground
                            bg-black/30 rounded-xl px-3 py-2.5">
              <span>{N.t('install_ios_1')}</span>
              <Share className="w-3.5 h-3.5 text-cyan-300 inline" />
              <span className="font-bold text-cyan-300">{N.t('install_ios_2')}</span>
              <span>{N.t('install_ios_3')}</span>
              <Plus className="w-3.5 h-3.5 text-cyan-300 inline" />
              <span className="font-bold text-cyan-300">{N.t('install_ios_4')}</span>
            </div>
          ) : (
            <button
              onClick={installer}
              className="w-full py-3 rounded-xl font-black font-display text-lg tracking-widest
                         text-background bg-primary hover:bg-primary/90 transition-all
                         border-b-4 border-amber-600 active:border-b-0 active:translate-y-1"
            >
              {N.t('install_do')}
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
