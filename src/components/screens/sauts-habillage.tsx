import React from 'react';

/**
 * L'HABILLAGE DES SAUTS : ce que l'ecran pose par-dessus la piste.
 *
 * Il vient de la planche de style (tools/blender/planche-style/interface) :
 * les memes polices, le meme vert de Jumper, les memes mots qu'avant. Ce qui
 * change, c'est que plus rien ne se lit a meme la piste. Chaque texte a son
 * fond, et plus rien ne descend sous 11 points : le classement flottait sur
 * le sable a 9 points et 45 % de noir, il ne se lisait pas au soleil.
 */

/** Le verre des panneaux : le noir du jeu, a 78 %, avec son flou. */
export const VITRE = 'bg-[rgba(6,9,19,0.78)] border border-white/12 backdrop-blur-sm';

/**
 * LE CARTOUCHE DES VERDICTS. Penche comme la vitesse, raye en biais comme
 * les bannieres du stade, un liseré de la couleur du verdict — vert parfait,
 * or a reprendre, rouge nul. Le texte, lui, reste droit.
 */
export function Cartouche({ texte, couleur, grand = false }: { texte: string; couleur: string; grand?: boolean }) {
  return (
    <div className="relative inline-flex items-center rounded-[3px] shadow-[0_8px_22px_rgba(0,0,0,0.45)]"
         style={{
           transform: 'skewX(-12deg)',
           padding: grand ? '5px 20px 6px 18px' : '4px 16px 5px 14px',
           borderLeft: `5px solid ${couleur}`,
           background: 'repeating-linear-gradient(135deg, rgba(255,255,255,0.045) 0 9px, transparent 9px 18px),'
             + ' linear-gradient(180deg, rgba(14,22,40,0.95), rgba(6,9,19,0.95))',
         }}>
      <span className={`font-display font-black tracking-tight uppercase whitespace-nowrap leading-none
                        ${grand ? 'text-[26px]' : 'text-xl'}`}
            style={{ transform: 'skewX(12deg)', color: couleur }}>
        {texte}
      </span>
    </div>
  );
}

/**
 * LES INSIGNES DE RECORD. Chacun sa couleur : le vert du jeu pour le record
 * personnel, l'or de Sprinter pour la saison, le tricolore pour le record
 * national, le rose de la marque pour le record du monde.
 */
export type SorteInsigne = 'rp' | 'mps' | 'rn' | 'rm';
const INSIGNES: Record<SorteInsigne, React.CSSProperties> = {
  rp: { background: 'rgb(var(--primaire-rgb))', color: '#060913' },
  mps: { background: '#FFD426', color: '#060913' },
  rn: { background: 'linear-gradient(90deg, #1f4fbf 0 33%, #fff 33% 67%, #e5383b 67%)', color: '#060913' },
  rm: { background: '#EC2E96', color: '#fff', boxShadow: '0 0 12px rgba(236,46,150,0.6)' },
};

export function Insigne({ sorte, texte }: { sorte: SorteInsigne; texte: string }) {
  return (
    <span className="inline-grid place-items-center min-w-[38px] h-5 px-[7px] rounded-[3px] font-mono font-bold text-xs"
          style={{ transform: 'skewX(-12deg)', ...INSIGNES[sorte] }}>
      <span style={{ transform: 'skewX(12deg)' }}
            className={sorte === 'rn' ? 'bg-white px-1 rounded-[2px]' : ''}>{texte}</span>
    </span>
  );
}
