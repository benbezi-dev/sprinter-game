import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { FEUILLE, VOILE } from '@/lib/mouvement';
import { useRetour } from '@/hooks/use-retour';
import { usePiste } from '@/game/piste';
import { demanderRetour } from '@/game/retour';
import { SprinterApp } from '@/game/engine';

/**
 * Les pages deja ouvertes d'elles-memes depuis le lancement du jeu.
 *
 * Deplie dans le menu, un panneau qui s'ouvrait seul ne genait personne. En
 * page plein ecran, il recouvre tout l'accueil : rouvert a chaque passage sur
 * l'onglet DEFI tant qu'une invitation attend, il empecherait d'atteindre le
 * reste. Il s'ouvre donc seul UNE fois par lancement ; ensuite, la pastille de
 * la carte suffit a dire qu'il y a quelque chose dessous.
 */
const ouvertesSeules = new Set<string>();

/**
 * UN PANNEAU QUI SE REPLIE.
 *
 * L'onglet DEFI empile quatre panneaux entiers : la course en direct avec son
 * choix d'epreuve, ses huit couloirs, son nom et ses deux boutons ; le
 * championnat ; le relais avec ses equipes, ses invitations, son formulaire et
 * son classement ; le code d'un defi recu. Depliés en meme temps ils font plus
 * de deux mille pixels — on cherche celui qu'on veut en faisant defiler, et on
 * passe devant trois autres a chaque fois.
 *
 * Ce n'est pas le probleme que resout `serre:` sur l'ecran de fin. La-bas tout
 * doit rester visible parce que tout vient d'arriver ; ici, on vient chercher
 * UNE chose et les trois autres attendent. Les replier n'enleve rien : le
 * titre reste, il dit ce qu'il y a dessous, et un doigt suffit a l'ouvrir.
 *
 * DEUX REGLES DE COMPORTEMENT, ET ELLES COMPTENT :
 *
 * 1. CE QUI ATTEND UNE REPONSE S'OUVRE TOUT SEUL. Une invitation au relais,
 *    un championnat en cours : le joueur ne peut pas deviner qu'il y a
 *    quelque chose sous un titre replie. `ouvertParDefaut` sert a ca, et
 *    seulement a ca — pas a decider qu'un panneau est plus important.
 *
 * 2. CE QU'ON A OUVERT LE RESTE. L'etat vit dans le composant, donc il survit
 *    au va-et-vient entre les onglets tant que l'accueil n'est pas quitte.
 *    Le ranger dans le stockage local ferait qu'un panneau ouvert une fois
 *    resterait ouvert des semaines, ce qui est l'inverse du but.
 */
export function Repliable({
  titre, sous, icone, couleur = 'text-emerald-400',
  ouvertParDefaut = false, marque, pleinEcran = false, children,
}: {
  titre: string;
  /** La phrase sous le titre, visible plie comme deplie. */
  sous?: string;
  icone?: React.ReactNode;
  /** La teinte du titre et de l'icone. Celle du panneau qu'on replie. */
  couleur?: string;
  ouvertParDefaut?: boolean;
  /**
   * Ce qui se voit SANS ouvrir : un compte d'invitations, un chrono, un etat.
   * C'est ce qui evite qu'un panneau replie devienne un panneau oublie.
   */
  marque?: React.ReactNode;
  /**
   * S'OUVRIR EN PAGE PLEIN ECRAN, PAS DANS LE MENU (l'auteur, 14/11/2026, video a
   * l'appui : le menu devenait illisible des qu'on ouvrait un mode).
   *
   * L'accueil tient a l'ecran sans defiler (hooks/use-menu-sans-defiler.ts) :
   * un panneau deplie dans le menu le faisait reduire d'autant, jusqu'a la
   * moitie de sa taille avec la course en direct et le relais ouverts. Ouvert
   * en page, le panneau ne pese plus rien dans le menu — qui garde sa taille —
   * et se lit en taille normale, avec un retour en haut a gauche (et le geste
   * retour du telephone). La page se ferme d'elle-meme quand une course de
   * relais commence : la piste passe devant (game/piste.ts).
   */
  pleinEcran?: boolean;
  children: React.ReactNode;
}) {
  /** S'ouvrir seul est-il encore permis ? Toujours deplie, une fois en page. */
  const peutSOuvrirSeul = () => !pleinEcran || !ouvertesSeules.has(titre);
  const [ouvert, setOuvert] = useState(() => {
    if (!ouvertParDefaut || !peutSOuvrirSeul()) return false;
    if (pleinEcran) ouvertesSeules.add(titre);
    return true;
  });
  /** Le joueur a-t-il touche a ce panneau ? Son choix prime sur tout. */
  const touche = useRef(false);

  // `ouvertParDefaut` arrive souvent APRES le premier rendu : le panneau
  // interroge le serveur, et ne decouvre qu'ensuite qu'une invitation attend.
  // On l'ouvre alors, mais une seule fois et jamais contre un choix deja fait.
  useEffect(() => {
    if (!ouvertParDefaut || touche.current || !peutSOuvrirSeul()) return;
    if (pleinEcran) ouvertesSeules.add(titre);
    setOuvert(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ouvertParDefaut]);

  const basculer = () => { touche.current = true; setOuvert(o => !o); };

  const enPage = pleinEcran && ouvert;
  const fermer = () => { touche.current = true; setOuvert(false); };
  // Une course de relais commence : la page laisse la place a la piste.
  const piste = usePiste();
  useEffect(() => { if (piste && pleinEcran) setOuvert(false); }, [piste, pleinEcran]);

  // Le focus revient sur la carte quand la page se ferme : sans cela il reste
  // sur un bouton disparu, et le clavier repart du haut du document.
  const carte = useRef<HTMLButtonElement | null>(null);
  const etaitEnPage = useRef(false);
  useEffect(() => {
    if (!enPage && etaitEnPage.current) carte.current?.focus({ preventScroll: true });
    etaitEnPage.current = enPage;
  }, [enPage]);

  if (pleinEcran) {
    return (
      <>
        <CartePage ref={carte} titre={titre} sous={sous} icone={icone} couleur={couleur}
                   marque={marque} ouverte={ouvert} onOuvrir={basculer} />
        <PagePleinEcran ouverte={enPage} titre={titre} sous={sous} icone={icone}
                        couleur={couleur} marque={marque} onRetour={fermer}>
          {children}
        </PagePleinEcran>
      </>
    );
  }

  return (
    <div className="bg-card/70 backdrop-blur-xl border border-white/10 rounded-2xl
                    shadow-2xl overflow-hidden">
      <button
        onClick={basculer}
        aria-expanded={ouvert}
        className="w-full flex items-center gap-2.5 px-4 py-3 md:px-6 md:py-4 text-left
                   hover:bg-white/[0.03] transition-colors"
      >
        {icone && <span className={`shrink-0 ${couleur}`}>{icone}</span>}
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className={`text-[10px] md:text-xs font-bold tracking-widest ${couleur}`}>
            {titre}
          </span>
          {sous && (
            <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2">
              {sous}
            </span>
          )}
        </span>
        {marque}
        {/* La fleche tourne : c'est le seul mouvement, et il dit dans quel sens
            le panneau va bouger. */}
        <ChevronDown
          className={`w-4 h-4 shrink-0 text-muted-foreground transition-transform duration-200
                      ${ouvert ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Rendu seulement ouvert. Un panneau du relais interroge le serveur au
          montage : le garder monte derriere un `hidden` ferait quatre appels
          pour un panneau qu'on regarde. */}
      {ouvert && (
        <div className="px-4 pb-4 md:px-6 md:pb-6 flex flex-col gap-3">
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * LA CARTE D'UN MODE QUI S'OUVRE EN PAGE : son titre, sa phrase, sa pastille,
 * et une fleche qui pointe vers la page plutot que vers le bas.
 */
export const CartePage = React.forwardRef<HTMLButtonElement, {
  titre: string; sous?: string; icone?: React.ReactNode; couleur?: string;
  marque?: React.ReactNode; ouverte: boolean; onOuvrir: () => void;
  /** Le cadre de la carte, pour qui veut la souligner (un salon en cours). */
  cadre?: string;
}>(function CartePage({ titre, sous, icone, couleur = 'text-emerald-400', marque, ouverte, onOuvrir, cadre }, ref) {
  return (
    <div className={`bg-card/70 backdrop-blur-xl border rounded-2xl shadow-2xl overflow-hidden
                     ${cadre || 'border-white/10'}`}>
      <button
        ref={ref}
        onClick={onOuvrir}
        aria-haspopup="dialog"
        aria-expanded={ouverte}
        className="w-full flex items-center gap-2.5 px-4 py-3 md:px-6 md:py-4 text-left
                   hover:bg-white/[0.03] transition-colors"
      >
        {icone && <span className={`shrink-0 ${couleur}`}>{icone}</span>}
        <span className="flex-1 min-w-0 flex flex-col gap-0.5">
          <span className={`text-[10px] md:text-xs font-bold tracking-widest ${couleur}`}>{titre}</span>
          {sous && (
            <span className="text-[10px] text-muted-foreground leading-snug line-clamp-2">{sous}</span>
          )}
        </span>
        {marque}
        <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
      </button>
    </div>
  );
});

/**
 * UNE PAGE PLEIN ECRAN, par-dessus l'accueil (l'auteur, 14/11/2026 : le menu
 * devenait illisible des qu'un mode se depliait dedans).
 *
 * Posee dans un portail : l'accueil porte des flous d'arriere-plan qui
 * enfermeraient une page `fixed` dans leur cadre. Montee en permanence, pour
 * que la page reparte par le bas au lieu de disparaitre d'un coup.
 *
 * Trois facons d'en sortir, qui font la meme chose (`onRetour`) : la fleche en
 * haut a gauche, le retour du telephone (game/retour.ts) et Echap sur le site.
 * Le retour et Echap passent par la meme pile : une fenetre ouverte par-dessus
 * la page — le classement des duels, le choix du nom — se ferme avant elle.
 */
export function PagePleinEcran({
  ouverte, titre, sous, icone, couleur = 'text-emerald-400', marque, onRetour, children,
}: {
  ouverte: boolean;
  titre: string;
  sous?: string;
  icone?: React.ReactNode;
  couleur?: string;
  marque?: React.ReactNode;
  onRetour: () => void;
  children: React.ReactNode;
}) {
  useRetour(onRetour, ouverte);

  useEffect(() => {
    if (!ouverte) return;
    const echap = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      demanderRetour();
    };
    window.addEventListener('keydown', echap);
    return () => window.removeEventListener('keydown', echap);
  }, [ouverte]);

  // Le focus part du retour a l'ouverture : un lecteur d'ecran ou le clavier
  // commencent la, et non derriere la page.
  const retour = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    if (ouverte) retour.current?.focus({ preventScroll: true });
  }, [ouverte]);

  const idTitre = 'page-' + titre.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return createPortal(
    <AnimatePresence>
      {ouverte && (
        <motion.div {...VOILE}
                    role="dialog" aria-modal="true" aria-labelledby={idTitre}
                    className="fixed inset-0 z-[45] overflow-y-auto overscroll-contain bg-[#05070d]/[0.97] backdrop-blur-md
                               pointer-events-auto text-foreground
                               px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                               pb-[max(env(safe-area-inset-bottom),1.5rem)]">
          <motion.div {...FEUILLE} className="w-full max-w-lg mx-auto flex flex-col gap-4">
            {/* L'en-tete reste en haut pendant qu'on fait defiler la page. Il
                ne porte que le titre : la phrase d'explication se lit en
                entier juste dessous, au lieu d'y etre coupee a deux lignes. */}
            <div className="sticky top-0 z-10 -mx-1 px-1 pt-[max(env(safe-area-inset-top),1rem)] pb-3
                            bg-[#05070d]/95 backdrop-blur-md flex items-center gap-3 border-b border-white/10">
              <button
                ref={retour}
                onClick={onRetour}
                aria-label={SprinterApp.N.t('page_retour')}
                className="shrink-0 w-11 h-11 rounded-xl border border-white/15 bg-white/5
                           flex items-center justify-center hover:bg-white/10 active:scale-95 transition"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              {icone && <span className={`shrink-0 ${couleur}`}>{icone}</span>}
              <h2 id={idTitre}
                  className={`flex-1 min-w-0 text-sm md:text-base font-black tracking-widest ${couleur} truncate`}>
                {titre}
              </h2>
              {marque}
            </div>
            {sous && <p className="-mt-1 text-xs text-muted-foreground leading-relaxed">{sous}</p>}
            <div className="flex flex-col gap-3">
              {children}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
