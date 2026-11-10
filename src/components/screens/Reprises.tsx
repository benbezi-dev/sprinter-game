import React, { useEffect, useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { Coins, Clapperboard } from 'lucide-react';
import { rafraichirPieces, usePieces, coutDuContinue, acheterContinue, type EtatPieces } from '@/game/pieces';
import { pubPossible, regarderUnePub, PUBS_PAR_CARRIERE } from '@/game/pub';
import { sansPubs } from '@/game/achats';

/**
 * LES REPRISES D'UNE ETAPE PERDUE : le Continue paye en pieces et la pub
 * « 2e chance ». Partage par la carriere classique (OverScreen) et la Legende
 * (FinDEtapeLegende) ; chacune garde ses compteurs et sait relancer son etape.
 *
 * L'OFFRE SE MONTRE MEME SANS LES MOYENS (decision du 6 octobre 2026). Le
 * bouton reste la, grise, avec son prix et ce qu'il manque : c'est la que
 * viendra l'achat de pieces en argent reel. Sans identifiant de parcours, le
 * serveur n'a rien a quoi rattacher l'achat : pas d'offre de pieces.
 */
type Props = {
  /** Identifiant du parcours aupres du serveur (8 a 64 caracteres), '' sans. */
  parcours: string;
  /** Continue deja achetes sur ce parcours. */
  achetes: number;
  /** Pubs deja regardees sur ce parcours. */
  pubs: number;
  /** Plafond de pubs du parcours : PUBS_PAR_CARRIERE par defaut ; la revanche
   *  d'un one shot a le sien (RevanchePub.tsx). */
  pubsMax?: number;
  /** Nom de l'etape a reprendre. */
  etape: string;
  /** Le serveur compte autrement : se recaler sur son compte. */
  recaler: (achetes: number) => void;
  /** Libelles de revanche (« REVANCHE · 10 », « REGARDER UNE PUB · REVANCHE »)
   *  au lieu de CONTINUER : duels et one shot (l'auteur, 10/11/2026). */
  revanche?: boolean;
  /** Relancer l'etape perdue, payee en pieces ou par une pub. */
  reprendre: (parPub: boolean) => void;
};

/** Une reprise est-elle proposee ? (pour dire « ou repartir de zero ».) */
export function repriseOfferte(pieces: EtatPieces | null, p: Pick<Props, 'parcours' | 'achetes' | 'pubs' | 'pubsMax'>): boolean {
  if (!p.parcours) return false;
  return coutDuContinue(pieces, p.achetes) != null || (pubPossible() && p.pubs < (p.pubsMax ?? PUBS_PAR_CARRIERE));
}

export function Reprises({ parcours, achetes, pubs, pubsMax = PUBS_PAR_CARRIERE, etape, revanche = false, recaler, reprendre }: Props) {
  const { N } = SprinterApp;
  const pieces = usePieces();
  const [achat, setAchat] = useState<'libre' | 'envoi' | 'reseau' | 'solde' | 'epuise' | 'nom'>('libre');
  const [pub, setPub] = useState<'libre' | 'envoi' | 'rate'>('libre');
  useEffect(() => { if (parcours) rafraichirPieces(); }, [parcours]);
  if (!parcours) return null;
  const cout = coutDuContinue(pieces, achetes);
  const peutPayer = cout != null && pieces != null && pieces.reserve && pieces.solde >= cout;
  const manque = cout != null && pieces ? Math.max(0, cout - (pieces.reserve ? pieces.solde : 0)) : 0;

  const handleContinue = async (essai = achetes, relance = false): Promise<void> => {
    if (cout == null || (achat === 'envoi' && !relance)) return;
    setAchat('envoi');
    const r = await acheterContinue(parcours, essai);
    if (r.ok) { reprendre(false); return; }
    // Le serveur compte autrement (un Continue paye dont la reponse s'est
    // perdue) : on se recale sur son compte et on redemande une fois.
    if (r.raison === 'desaccord' && typeof r.essai === 'number' && !relance) {
      recaler(r.essai);
      return handleContinue(r.essai, true);
    }
    setAchat(r.raison === 'desaccord' ? 'reseau' : r.raison);
    rafraichirPieces();
  };

  // LA PUB « 2E CHANCE » (game/pub.ts) : reprend l'etape comme un Continue,
  // sans pieces, PUBS_PAR_CARRIERE fois. Pas de bouton la ou il n'y a pas de pub.
  const pubOfferte = pubPossible() && pubs < pubsMax;
  const handlePub = async () => {
    if (pub === 'envoi') return;
    setPub('envoi');
    // Sans pubs (game/achats.ts) : la meme 2e chance, sans la video.
    if (sansPubs() || await regarderUnePub()) { reprendre(true); return; }
    setPub('rate');
  };

  return (
    <>
      {/* Le Continue : reprendre l'etape perdue contre des pieces. Toujours
          montre tant qu'il en reste un a acheter, grise faute de pieces. */}
      {pieces && cout != null && (
        <div className="w-full max-w-md flex flex-col items-center gap-1.5">
          {pieces.reserve && (
            <div className="flex items-center gap-1.5 text-primary font-bold text-sm md:text-base">
              <Coins className="w-4 h-4" />{N.t('pieces_solde', { n: pieces.solde })}
            </div>
          )}
          {!revanche && <div className="text-xs md:text-sm text-foreground/80 uppercase tracking-widest">
            {N.t('pieces_reprendre', { etape: etape })}
          </div>}
          <button onClick={() => handleContinue()} disabled={!peutPayer || achat === 'envoi'}
            aria-disabled={!peutPayer}
            className={peutPayer
              ? 'w-full py-2.5 md:py-4 [@media(max-height:780px)]:py-2 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-primary-foreground bg-primary hover:brightness-110 disabled:opacity-60 transition-all border-b-4 border-black/30 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2'
              : 'w-full py-2.5 md:py-4 [@media(max-height:780px)]:py-2 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-primary/60 bg-primary/10 border-2 border-dashed border-primary/40 cursor-not-allowed flex items-center justify-center gap-2'}>
            {N.t(revanche ? 'pieces_revanche' : 'pieces_continuer', { n: cout })}<Coins className="w-5 h-5 md:w-6 md:h-6" />
          </button>
          {!peutPayer && (
            <div className="flex flex-col items-center gap-0.5 text-center">
              <div className="text-xs md:text-sm font-bold text-primary/90">
                {pieces.reserve ? N.t('pieces_manque', { n: manque }) : N.t('pieces_nom')}
              </div>
              <div className="text-[11px] md:text-xs text-muted-foreground [@media(max-height:780px)]:hidden">{N.t('pieces_gagner')}</div>
            </div>
          )}
          {achat === 'reseau' && <div className="text-xs text-destructive">{N.t('pieces_reseau')}</div>}
          {achat === 'solde' && <div className="text-xs text-destructive">{N.t('pieces_manque', { n: manque })}</div>}
          {achat === 'nom' && <div className="text-xs text-destructive">{N.t('pieces_nom')}</div>}
        </div>
      )}
      {pubOfferte && (
        <div className="w-full max-w-md flex flex-col items-center gap-1">
          {!revanche && !(pieces && cout != null) && (
            <div className="text-xs md:text-sm text-foreground/80 uppercase tracking-widest">
              {N.t('pieces_reprendre', { etape: etape })}
            </div>
          )}
          <button onClick={handlePub} disabled={pub === 'envoi'}
            className="w-full py-2.5 md:py-4 [@media(max-height:780px)]:py-2 rounded-xl font-black font-display text-sm sm:text-xl md:text-2xl whitespace-nowrap tracking-widest text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-60 transition-all border-2 border-primary active:translate-y-1 flex items-center justify-center gap-2">
            {sansPubs() ? N.t('pub_offerte') : N.t(pub === 'envoi' ? 'pub_charge' : revanche ? 'pub_revanche' : 'pub_continuer')}{!sansPubs() && <Clapperboard className="w-5 h-5 md:w-6 md:h-6" />}
          </button>
          {pub === 'rate' && <div className="text-xs text-destructive">{N.t('pub_rate')}</div>}
        </div>
      )}
      {pieces && pieces.reserve && cout == null && (
        <div className="text-xs md:text-sm text-muted-foreground mt-2">{N.t('pieces_epuise')}</div>
      )}
    </>
  );
}
