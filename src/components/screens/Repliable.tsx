import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

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
  ouvertParDefaut = false, marque, children,
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
  children: React.ReactNode;
}) {
  const [ouvert, setOuvert] = useState(ouvertParDefaut);
  /** Le joueur a-t-il touche a ce panneau ? Son choix prime sur tout. */
  const touche = useRef(false);

  // `ouvertParDefaut` arrive souvent APRES le premier rendu : le panneau
  // interroge le serveur, et ne decouvre qu'ensuite qu'une invitation attend.
  // On l'ouvre alors, mais une seule fois et jamais contre un choix deja fait.
  useEffect(() => {
    if (ouvertParDefaut && !touche.current) setOuvert(true);
  }, [ouvertParDefaut]);

  const basculer = () => { touche.current = true; setOuvert(o => !o); };

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
