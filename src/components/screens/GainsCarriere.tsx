import React, { useEffect, useState } from 'react';
import { Clapperboard, Coins } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { doublerCarriere, usePieces } from '@/game/pieces';
import { pubPossible, regarderUnePub } from '@/game/pub';
import { sansPubs } from '@/game/achats';

/**
 * LES PIECES D'UNE CARRIERE GAGNEE, a l'ecran du sacre (WinAllScreen).
 *
 * Montre ce que les six etapes ont rapporte, puis offre de le DOUBLER contre
 * une pub (decision du 14/11/2026). C'est la pub que le joueur choisit
 * librement, au meilleur moment — il vient de gagner —, et elle ajoute une vue
 * au lieu d'en prendre a la pub « 2e chance ». Une fois par carriere ; le
 * serveur relit lui-meme le total dans son journal (worker/src/pieces.js).
 *
 * Rien ne s'affiche sans nom reserve, sans pieces gagnees, ou hors carriere.
 */
export function GainsCarriere() {
  const { N } = SprinterApp;
  const pieces = usePieces();
  // La carriere qu'on affiche, relevee au montage : REJOUER en tire une neuve.
  const [parcours] = useState<string>(() => String(SprinterApp.G.runId || ''));
  const [course] = useState<string>(() => String(SprinterApp.G.raceKey || ''));
  const [carriere] = useState(() => SprinterApp.G.mode === 'campaign');
  const [gagne, setGagne] = useState<number>(() => SprinterApp.G.runPieces || 0);
  const [etat, setEtat] = useState<'offre' | 'envoi' | 'rate' | 'reseau' | 'fait'>('offre');
  // Une pub regardee jusqu'au bout reste due : si le serveur n'a pas repondu,
  // on redemande le doublement sans la repasser.
  const [pubVue, setPubVue] = useState(false);
  const [double, setDouble] = useState(0);

  // La finale a pu etre annoncee au serveur pendant le generique, sans que la
  // reponse soit deja la : on relit le total quelques secondes.
  useEffect(() => {
    let tours = 0;
    const t = setInterval(() => {
      if (SprinterApp.G.runId === parcours) setGagne(SprinterApp.G.runPieces || 0);
      if (++tours >= 16) clearInterval(t);
    }, 500);
    return () => clearInterval(t);
  }, [parcours]);

  if (!carriere || !parcours || !pieces || !pieces.reserve || gagne <= 0) return null;

  const offert = sansPubs();
  const pubOfferte = offert || pubPossible();

  const handleDoubler = async () => {
    if (etat === 'envoi' || etat === 'fait') return;
    setEtat('envoi');
    // Sans pubs (game/achats.ts) : le meme doublement, sans la video.
    if (!offert && !pubVue) {
      if (!(await regarderUnePub())) { setEtat('rate'); return; }
      setPubVue(true);
    }
    const n = await doublerCarriere(parcours, course);
    if (n == null) { setEtat('reseau'); return; }
    setDouble(n);
    setEtat('fait');
  };

  return (
    <div className="w-full flex flex-col items-center gap-2">
      <div className="flex items-center gap-1.5 text-primary font-black text-base md:text-lg">
        <Coins className="w-5 h-5" />{N.t('pieces_carriere', { n: gagne })}
      </div>
      {pubOfferte && etat !== 'fait' && (
        <button onClick={handleDoubler} disabled={etat === 'envoi'}
          className="w-full py-2.5 md:py-4 rounded-xl font-black font-display text-sm sm:text-xl md:text-2xl whitespace-nowrap tracking-widest text-primary bg-primary/10 hover:bg-primary/20 disabled:opacity-60 transition-all border-2 border-primary active:translate-y-1 flex items-center justify-center gap-2">
          {offert || pubVue ? N.t('pieces_double_offert')
            : N.t(etat === 'envoi' ? 'pub_charge' : 'pieces_double')}
          {!offert && !pubVue && <Clapperboard className="w-5 h-5 md:w-6 md:h-6" />}
        </button>
      )}
      {etat === 'rate' && <div className="text-xs text-destructive">{N.t('pub_rate')}</div>}
      {etat === 'reseau' && <div className="text-xs text-destructive">{N.t('pieces_reseau')}</div>}
      {etat === 'fait' && (
        <div className="text-sm font-bold text-primary">
          {double > 0 ? N.t('pieces_doublees', { n: double }) : N.t('pieces_double_rien')}
        </div>
      )}
    </div>
  );
}
