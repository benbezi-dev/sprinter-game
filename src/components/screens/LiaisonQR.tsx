import React, { useEffect, useRef, useState } from 'react';
import { Loader2, QrCode, Copy, Check, RotateCcw } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { ouvrirTransfert, lienDeLiaison, type TransfertOuvert } from '@/game/identity';

/**
 * Relier un autre telephone sans rien retaper.
 *
 * Le geste que cet ecran remplace : dicter six caracteres a soi-meme d'un
 * telephone a l'autre, en se trompant sur le O et le zero. Le QR code enleve
 * l'epellation ; le jeton a usage unique enleve le risque qu'un code dicte
 * traine ensuite dans une conversation.
 *
 * Le QR est dessine sur un fond blanc franc, meme si le jeu est sombre : un
 * lecteur cherche un contraste net entre les modules, et un QR clair sur fond
 * sombre est refuse par une partie des appareils photo.
 *
 * L'encodeur est charge a la demande. Il pese une quinzaine de kilo-octets
 * compresses, et la quasi-totalite des joueurs ne relieront jamais un second
 * telephone : les faire tous payer ce poids au demarrage pour un ecran qui
 * s'ouvre sur un bouton serait le mauvais arbitrage.
 */
export function LiaisonQR({ nom }: { nom: string }) {
  const { N } = SprinterApp;
  const [ouvert, setOuvert] = useState(false);
  const [jeton, setJeton] = useState<TransfertOuvert | null>(null);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'erreur'>('repos');
  const [copie, setCopie] = useState(false);
  const toile = useRef<HTMLCanvasElement | null>(null);

  const tirer = async () => {
    setEtat('envoi'); setJeton(null);
    const r = await ouvrirTransfert(nom);
    if (!r) { setEtat('erreur'); return; }
    setJeton(r); setEtat('repos');
  };

  // Le dessin attend que la toile existe : elle n'est montee qu'une fois le
  // jeton recu, donc le rendu ne peut pas se faire dans la meme foulee.
  useEffect(() => {
    if (!jeton || !toile.current) return;
    let vivant = true;
    import('qrcode')
      .then(({ default: QRCode }) => {
        if (!vivant || !toile.current) return;
        return QRCode.toCanvas(toile.current, lienDeLiaison(jeton.jeton), {
          margin: 1, width: 208, errorCorrectionLevel: 'M',
          color: { dark: '#000000', light: '#FFFFFF' },
        });
      })
      .catch(() => { if (vivant) setEtat('erreur'); });
    return () => { vivant = false; };
  }, [jeton]);

  const copier = async () => {
    if (!jeton) return;
    try {
      await navigator.clipboard.writeText(lienDeLiaison(jeton.jeton));
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refuse : le QR reste */ }
  };

  if (!ouvert) {
    return (
      <button
        onClick={() => { setOuvert(true); tirer(); }}
        className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-primary
                   transition-colors flex items-center gap-1.5 self-start"
      >
        <QrCode className="w-3 h-3" /> {N.t('id_qr_open')}
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 flex flex-col items-center gap-2">
      <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
        {N.t('id_qr_title')}
      </span>

      {etat === 'envoi' && <Loader2 className="w-5 h-5 animate-spin text-muted-foreground my-6" />}

      {etat === 'erreur' && (
        <>
          <span className="text-[10px] text-destructive text-center">{N.t('score_save_fail')}</span>
          <button onClick={tirer}
                  className="text-[10px] font-bold tracking-widest text-muted-foreground
                             hover:text-primary transition-colors flex items-center gap-1.5">
            <RotateCcw className="w-3 h-3" /> {N.t('id_qr_new')}
          </button>
        </>
      )}

      {jeton && etat === 'repos' && (
        <>
          <div className="rounded-xl bg-white p-2">
            <canvas ref={toile} className="block" />
          </div>
          <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug max-w-[15rem]">
            {N.t('id_qr_help')}
          </p>
          <span className="text-[9px] text-muted-foreground/70 tracking-wide">
            {N.t('id_qr_expire', { m: Math.round(jeton.vie_ms / 60000) })}
          </span>
          <div className="flex items-center gap-3">
            <button onClick={copier}
                    className="text-[10px] font-bold tracking-widest text-muted-foreground
                               hover:text-primary transition-colors flex items-center gap-1.5">
              {copie ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copie ? N.t('code_copied') : N.t('id_qr_copy')}
            </button>
            <button onClick={tirer}
                    className="text-[10px] font-bold tracking-widest text-muted-foreground
                               hover:text-primary transition-colors flex items-center gap-1.5">
              <RotateCcw className="w-3 h-3" /> {N.t('id_qr_new')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
