import React, { type ReactNode } from 'react';

/**
 * Le cadre des ecrans d'arrivee : le compte rendu defile, les boutons restent.
 *
 * Un ecran de fin dit deux choses — ce qui vient de se passer, et ce qu'on
 * peut faire ensuite. La premiere s'allonge sans fin : chronos epreuve par
 * epreuve, resultat du duel, TOP 500, defi a envoyer, image a partager. La
 * seconde ne fait jamais que trois lignes.
 *
 * Les empiler dans un meme rouleau poussait RECOMMENCER, DEFIER et surtout
 * ACCUEIL sous la ligne de flottaison : il fallait faire defiler tout le
 * compte rendu pour retrouver la sortie. Une sortie qu'on doit chercher n'en
 * est pas une, et sur un telephone c'est la premiere chose qu'on cherche.
 *
 * Le compte rendu prend donc la hauteur qui reste et defile seul ; la barre
 * d'actions est posee en bas, hors du rouleau, et ne bouge plus. C'est aussi
 * ce qui permet au compte rendu de s'allonger sans jamais coacher la sortie.
 */
export function EcranFin({
  fond = 'bg-black/90 backdrop-blur-md',
  actions,
  children,
}: {
  /** Le voile pose sur la piste — chaque ecran garde le sien. */
  fond?: string;
  /** Les boutons de la barre du bas, empiles dans une colonne au pas fixe. */
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`w-full h-full flex flex-col pointer-events-auto ${fond}`}>

      {/* Le compte rendu. `min-h-0` est ce qui l'autorise a se comprimer
          plutot qu'a pousser la barre hors de l'ecran : sans lui, un enfant
          en flex-col garde sa hauteur naturelle et deborde par le bas. */}
      <div className="flex-1 min-h-0 overflow-y-auto
                      px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                      pt-[max(env(safe-area-inset-top),1rem)]">
        <div className="min-h-full flex flex-col items-center justify-center w-full pb-3">
          {children}
        </div>
      </div>

      {/* La barre d'actions, toujours visible. */}
      <div className="barre-fin shrink-0 relative border-t border-white/10 bg-[#060913]/95 backdrop-blur-md
                      px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]
                      pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {/* Le degrade dit qu'il reste quelque chose au-dessus : une carte
            coupee net par la barre se lit comme la fin de la page, et on ne
            fait pas defiler ce qu'on croit avoir fini de lire. */}
        <div aria-hidden
             className="pointer-events-none absolute inset-x-0 -top-8 h-8
                        bg-gradient-to-t from-[#060913] to-transparent" />
        <div className="mx-auto w-full max-w-md flex flex-col gap-2">
          {actions}
        </div>
      </div>

    </div>
  );
}
