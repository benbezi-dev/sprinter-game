import React, { useEffect, useState } from 'react';
import { SprinterApp, useGameStore } from '@/game/engine';
import { motion } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { Coins } from 'lucide-react';
import { rafraichirPieces, usePieces, coutDuContinue, acheterContinue } from '@/game/pieces';

export function OverScreen() {
  const levelIdx = useGameStore(s => s.levelIdx);
  const player = useGameStore(s => s.player);
  const ranking = useGameStore(s => s.ranking);
  const { N } = SprinterApp;

  // LE CONTINUE. Seulement en carriere : un one shot n'a pas d'etape ou
  // reprendre. Le prix vient du serveur et monte a chaque Continue de la
  // meme carriere ; quand il n'y en a plus, il ne reste que « repartir de
  // zero », comme avant.
  //
  // L'OFFRE SE MONTRE MEME SANS LES MOYENS (decision du 6 octobre 2026). Le
  // bouton reste la, grise, avec son prix et ce qu'il manque : le joueur
  // apprend que la defaite peut s'acheter, et c'est la que viendra l'achat de
  // pieces en argent reel — ce jour-la, le bouton grise ouvrira la boutique.
  // Sans identifiant de carriere (une course qui n'est pas partie de
  // startRun), le serveur n'a rien a quoi rattacher l'achat : pas d'offre.
  const enCarriere = SprinterApp.G.mode === 'campaign' && !!SprinterApp.G.runId;
  const pieces = usePieces();
  const [achat, setAchat] = useState<'libre' | 'envoi' | 'reseau' | 'solde' | 'epuise' | 'nom'>('libre');
  useEffect(() => { if (enCarriere) rafraichirPieces(); }, [enCarriere]);
  const cout = enCarriere ? coutDuContinue(pieces, SprinterApp.G.runContinues || 0) : null;
  const peutPayer = cout != null && pieces != null && pieces.reserve && pieces.solde >= cout;
  const manque = cout != null && pieces ? Math.max(0, cout - (pieces.reserve ? pieces.solde : 0)) : 0;

  const handleContinue = async (relance = false) => {
    if (cout == null || achat === 'envoi') return;
    setAchat('envoi');
    const r = await acheterContinue(SprinterApp.G.runId, SprinterApp.G.runContinues || 0);
    if (r.ok) { SprinterApp.continuerCarriere(); return; }
    // Le serveur compte autrement (un Continue paye dont la reponse s'est
    // perdue) : on se recale sur son compte et on redemande une fois.
    if (r.raison === 'desaccord' && typeof r.essai === 'number' && !relance) {
      SprinterApp.G.runContinues = r.essai;
      setAchat('libre');
      return handleContinue(true);
    }
    setAchat(r.raison === 'desaccord' ? 'reseau' : r.raison);
    rafraichirPieces();
  };

  const startRecap = () => {
    if (!player || player.reaction === null) return N.t('no_start');
    const g = player.transGrade === null ? 0 : player.transGrade;
    return N.t('start_line', { r: player.jumped ? '--' : player.reaction.toFixed(3), g: N.t('trans_' + g) });
  };

  const handleRetry = () => {
    SprinterApp.startRun();
  };
  
  const handleHome = () => {
    SprinterApp.G.state = 'title';
    SprinterApp.buildLevel(0);
  };
  
  const rank = ranking.indexOf(player) + 1;

  return (
    <div className="w-full h-full flex flex-col pointer-events-auto bg-black/90 backdrop-blur-sm overflow-y-auto px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)] pt-[max(env(safe-area-inset-top),1rem)] pb-[max(env(safe-area-inset-bottom),1rem)]">
      <div className="min-h-full flex flex-col items-center justify-center w-full">
        <motion.div {...MONTEE} className="flex flex-col items-center max-w-2xl w-full py-6 md:py-8 gap-4 md:gap-6">
          
          <div className="flex flex-col items-center text-center gap-1 md:gap-2">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-black font-display text-destructive tracking-tight uppercase drop-shadow-md">
              {N.t('place', { o: N.ord(rank, true) })}
            </h1>
            
            <div className="text-sm sm:text-base font-medium text-foreground/80 tracking-wide uppercase">
              {N.levelName(levelIdx)} &mdash; {player?.finishTime ? `${player.finishTime.toFixed(2)} s` : N.t('unfinished')}
            </div>
            
            <div className="text-[10px] sm:text-xs md:text-sm font-bold tracking-widest text-cyan-400 uppercase">
              {startRecap()}
            </div>
          </div>

          {/* Leaderboard Card */}
          <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 sm:p-4 md:p-6 shadow-2xl">
            <div className="flex flex-col gap-1.5 md:gap-2">
              {ranking.map((r, i) => {
                const isMe = r.isPlayer;
                const mc = i === 0 ? 'text-primary' : i === 1 ? 'text-slate-300' : i === 2 ? 'text-amber-600' : 'text-muted-foreground';
                const nc = isMe ? 'text-primary' : r.name === SprinterApp.G.champion ? 'text-fuchsia-400' : 'text-foreground';
                const tc = r.finishTime ? 'text-foreground' : 'text-destructive';
                
                return (
                  <div key={i} className={`flex items-center justify-between px-3 py-2 md:px-4 md:py-3 rounded-xl border ${isMe ? 'bg-destructive/20 border-destructive/50' : 'border-white/5 bg-black/20'}`}>
                    <div className="flex items-center gap-2 md:gap-4 overflow-hidden pr-2">
                      <span className={`font-bold w-6 md:w-8 shrink-0 text-sm md:text-base ${mc}`}>{N.ord(i + 1)}</span>
                      <span className={`font-bold tracking-wide truncate text-sm md:text-base ${nc}`}>{isMe ? N.t('you') : r.name}</span>
                    </div>
                    <span className={`font-mono font-bold shrink-0 text-sm md:text-base ${tc}`}>
                      {r.finishTime ? `${r.finishTime.toFixed(2)} s` : N.t('dnf')}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Le Continue : reprendre l'etape perdue contre des pieces. Toujours
              montre tant qu'il en reste un a acheter, grise faute de pieces. */}
          {enCarriere && pieces && cout != null && (
            <div className="w-full max-w-md flex flex-col items-center gap-2 mt-2">
              {pieces.reserve && (
                <div className="flex items-center gap-1.5 text-amber-300 font-bold text-sm md:text-base">
                  <Coins className="w-4 h-4" />{N.t('pieces_solde', { n: pieces.solde })}
                </div>
              )}
              <div className="text-xs md:text-sm text-foreground/80 uppercase tracking-widest">
                {N.t('pieces_reprendre', { etape: N.levelName(levelIdx) })}
              </div>
              <button onClick={() => handleContinue()} disabled={!peutPayer || achat === 'envoi'}
                aria-disabled={!peutPayer}
                className={peutPayer
                  ? 'w-full py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-background bg-amber-400 hover:bg-amber-300 disabled:opacity-60 transition-all border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 flex items-center justify-center gap-2'
                  : 'w-full py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-amber-300/60 bg-amber-400/10 border-2 border-dashed border-amber-400/40 cursor-not-allowed flex items-center justify-center gap-2'}>
                {N.t('pieces_continuer', { n: cout })}<Coins className="w-5 h-5 md:w-6 md:h-6" />
              </button>
              {!peutPayer && (
                <div className="flex flex-col items-center gap-0.5 text-center">
                  <div className="text-xs md:text-sm font-bold text-amber-300/90">
                    {pieces.reserve ? N.t('pieces_manque', { n: manque }) : N.t('pieces_nom')}
                  </div>
                  <div className="text-[11px] md:text-xs text-muted-foreground">{N.t('pieces_gagner')}</div>
                </div>
              )}
              {achat === 'reseau' && <div className="text-xs text-destructive">{N.t('pieces_reseau')}</div>}
              {achat === 'solde' && <div className="text-xs text-destructive">{N.t('pieces_manque', { n: manque })}</div>}
              {achat === 'nom' && <div className="text-xs text-destructive">{N.t('pieces_nom')}</div>}
            </div>
          )}
          {enCarriere && pieces && pieces.reserve && cout == null && (
            <div className="text-xs md:text-sm text-muted-foreground mt-2">{N.t('pieces_epuise')}</div>
          )}

          <div className="text-base sm:text-lg md:text-xl font-bold tracking-widest text-foreground uppercase mt-2">
            {N.t(cout != null ? 'pieces_zero' : 'race_again')}
          </div>

          {/* Actions */}
          <div className="flex gap-3 md:gap-4 w-full max-w-md">
            <button onClick={handleRetry} className="flex-1 py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-background bg-emerald-400 hover:bg-emerald-300 transition-all border-b-4 border-emerald-600 active:border-b-0 active:translate-y-1">
              {N.t('yes').toUpperCase()}
            </button>
            <button onClick={handleHome} className="flex-1 py-3 md:py-4 rounded-xl font-black font-display text-lg sm:text-xl md:text-2xl tracking-widest text-background bg-destructive hover:bg-red-400 transition-all border-b-4 border-red-700 active:border-b-0 active:translate-y-1">
              {N.t('no').toUpperCase()}
            </button>
          </div>

        </motion.div>
      </div>
    </div>
  );
}
