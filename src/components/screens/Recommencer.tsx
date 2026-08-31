/* ---------------------------------------------------------------------------
   RECOMMENCER, SEUL OU ENSEMBLE
   ---------------------------------------------------------------------------
   Le raccourci de l'ecran d'arrivee a d'abord ete pense pour un joueur seul :
   apres un faux depart ou une course ratee, relancer dix secondes de course
   sans repasser par l'accueil, le menu et le mode. Il ne prenait rien a
   personne, donc rien ne justifiait de l'interdire — voir game/reprise.

   La course en direct est le seul endroit ou cela ne suffit pas, et pour une
   raison qui n'est pas technique : l'adversaire est encore la. Recommencer
   seul, sous ses yeux, revient a quitter la piste sans le dire. Ce que deux
   joueurs qui viennent de courir ensemble veulent, ce n'est pas une course de
   plus — c'est LA MEME, contre le meme, tout de suite.

   D'ou un accord, et pas un raccourci : chacun demande la revanche, chacun
   voit ou en est l'autre, et la piste repart quand tout le monde a dit oui.
   Un seul des deux ne peut pas relancer la course de l'autre — c'etait
   possible avant ce fichier, par un effet de bord : les drapeaux « pret »
   restaient leves de la course precedente, et il suffisait d'en baisser un
   pour le relever aussitot. L'autre repartait sans avoir rien demande, souvent
   sans avoir fini de lire son resultat.

   Le solo n'est pas retire pour autant. Il reste, en second plan, et il dit ce
   qu'il fait : on quitte la piste. Un joueur dont l'adversaire ne repond plus
   ne doit pas rester coince devant un bouton qui attend.
--------------------------------------------------------------------------- */

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { RotateCcw, Loader2 } from 'lucide-react';
import { SprinterApp, brancherSalle } from '@/game/engine';
import { salonCourant, quitterSalon } from '@/game/salon-direct';
import type { EtatSalle } from '@/game/live';

/**
 * Le bouton, sans rien decider.
 *
 * Partage entre le raccourci solo et la revanche : deux boutons a la meme
 * place sur le meme ecran doivent avoir exactement la meme allure, sinon celui
 * qui change de mode croit avoir change d'ecran.
 */
export function BoutonRecommencer({ children, onClick, attente = false }: {
  children: React.ReactNode;
  onClick: () => void;
  /** On a dit oui, et l'on attend l'autre : le bouton se retire d'un ton. */
  attente?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full py-3 md:py-4 rounded-xl font-black font-display text-base sm:text-lg md:text-xl
                  tracking-widest transition-all flex items-center justify-center gap-2
        ${attente
          ? 'bg-emerald-400/15 text-emerald-300 border border-emerald-400/40'
          : `text-background bg-emerald-400 hover:bg-emerald-300
             border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1`}`}
    >
      {attente ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
      {children}
    </button>
  );
}

/**
 * Repartir seul depuis une course en direct.
 *
 * On ferme la piste, et c'est le point important : sans cela le jeu relance
 * une course locale pendant que la salle reste ouverte, l'adversaire attendant
 * une revanche qui ne viendra jamais. Quitter en le disant vaut mieux que
 * disparaitre — l'autre recoit « ton adversaire a quitte la piste » et sait a
 * quoi s'en tenir.
 */
function repartirSeul() {
  quitterSalon();
  brancherSalle(null);
  SprinterApp.recommencer();
}

/**
 * La revanche en direct.
 *
 * Rend le bloc entier de l'ecran d'arrivee : le bouton, l'etat de chacun, et
 * le repli solo. Quand il n'y a plus de piste — l'adversaire est parti, la
 * salle a expire, la page a ete rechargee — il ne reste que le raccourci
 * habituel, ce qui est exactement ce qu'il faut : une course de plus, seul.
 */
export function RevancheDirecte() {
  const { N } = SprinterApp;

  // La salle est un singleton de module : elle survit au demontage de l'ecran
  // qui l'a ouverte, et c'est ce qui rend ce composant possible.
  const salle = salonCourant();

  const [etat, setEtat] = useState<EtatSalle | null>(salle?.dernierEtat ?? null);
  const [ouverte, setOuverte] = useState(!!salle?.ouverte);

  useEffect(() => {
    if (!salle) return;
    // On OBSERVE, on ne pilote pas. `ecouter` remplacerait les ecouteurs du
    // panneau du direct — celui qui monte la piste, donne le depart et route
    // les positions — et la revanche partirait chez l'adversaire sans partir
    // ici. Voir Salle.observer.
    return salle.observer(e => { setEtat(e); setOuverte(salle.ouverte); });
  }, [salle]);

  const joueurs = etat?.joueurs || [];
  const places = etat?.max || 2;
  const moi = salle?.moi || '';
  const jaiDitOui = !!joueurs.find(j => j.id === moi)?.pret;
  const autres = joueurs.filter(j => j.id !== moi);
  /** Il manque quelqu'un : personne ne recommence une course a un couloir. */
  const complet = joueurs.length >= places;
  /**
   * Qui n'a pas encore dit oui — MOI COMPRIS.
   *
   * Les compter parmi les autres seulement etait faux, et se voyait tout de
   * suite : celui a qui l'on venait de proposer la revanche lisait « tout le
   * monde est d'accord » alors qu'il n'avait rien dit. Il ne restait plus
   * personne a attendre... sauf lui.
   */
  const manquants = joueurs.filter(j => !j.pret);
  const autresPrets = autres.filter(j => j.pret);
  const tousDaccord = complet && manquants.length === 0;

  // --- plus de piste : le raccourci d'origine, et rien d'autre -------------
  //
  // Le solo ne s'annonce pas comme un repli quand c'est la seule chose qui
  // reste : ce serait dire au joueur ce qu'il a perdu au moment ou il n'y peut
  // plus rien.
  if (!salle || !ouverte || !complet) {
    return (
      <>
        <BoutonRecommencer onClick={repartirSeul}>{N.t('os_rejouer')}</BoutonRecommencer>
        <p className="text-center text-[10px] md:text-xs text-muted-foreground leading-snug -mt-1">
          {N.t(salle && !complet ? 'live_encore_parti' : 'os_rejouer_sub')}
        </p>
      </>
    );
  }

  return (
    <>
      <BoutonRecommencer attente={jaiDitOui}
                         onClick={() => salle.pret(!jaiDitOui)}>
        {N.t(jaiDitOui ? 'live_encore_attente' : 'live_encore')}
      </BoutonRecommencer>

      {/* CHACUN VOIT L'AUTRE. C'est la moitie de la fonction : un accord dont
          on ne voit pas l'autre moitie n'est pas un accord, c'est une attente.
          Le meme dessin qu'au salon, volontairement — c'est le meme geste. */}
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  className="flex flex-col gap-1.5 -mt-1">
        {joueurs.map(j => (
          <div key={j.id}
               className={`flex items-center justify-between px-3 py-2 rounded-xl border
                 ${j.pret ? 'border-emerald-400/40 bg-emerald-400/[0.08]'
                          : 'border-white/10 bg-black/25'}`}>
            <span className="text-xs md:text-sm font-bold tracking-wide truncate
                             text-foreground min-w-0">
              {j.id === moi ? N.t('duel_you') : j.nom}
            </span>
            <span className={`text-[9px] md:text-[10px] font-bold tracking-widest shrink-0
              ${j.pret ? 'text-emerald-400' : 'text-muted-foreground'}`}>
              {N.t(j.pret ? 'live_encore_oui' : 'live_encore_pas')}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Ce qu'il manque, en une phrase. Elle change de camp selon qui attend
          qui : « en attente de X » quand la balle est chez lui, et l'inverse
          quand elle est chez nous — un joueur qui lit « X veut recommencer »
          sait qu'il n'a plus qu'a toucher le bouton. */}
      <p className="text-center text-[10px] md:text-xs leading-snug -mt-1
                    text-muted-foreground">
        {tousDaccord
          ? N.t('live_encore_part')
          : jaiDitOui
            ? N.t('live_encore_wait', { n: manquants.map(j => j.nom).join(', ') })
            : autresPrets.length
              ? N.t('live_encore_veut', { n: autresPrets.map(j => j.nom).join(', ') })
              : N.t('live_encore_sub')}
      </p>

      {/* Le solo passe en second plan, et dit son prix. Il reste atteignable :
          rien n'oblige a attendre quelqu'un qui ne repond plus. */}
      <button
        onClick={repartirSeul}
        className="text-[10px] md:text-xs tracking-widest text-muted-foreground
                   hover:text-foreground transition-colors"
      >
        {N.t('live_encore_seul')}
      </button>
    </>
  );
}
