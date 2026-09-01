import React, { useState } from 'react';
import { Loader2, LifeBuoy, Instagram, Copy, Check, RotateCcw } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { saveName } from '@/game/leaderboard';
import {
  demanderRecuperation, etatRecuperation, lienMessageJeu, type Recuperation as Etat,
} from '@/game/identity';

/**
 * Retrouver son nom quand il ne reste rien.
 *
 * Cet ecran ne verifie rien lui-meme, et c'est voulu : sans e-mail ni mot de
 * passe, le jeu n'a aucun secret partage avec le joueur. Le chrono, le rang et
 * le pseudo Instagram sont affiches au TOP 500 — les redemander ici ne
 * prouverait rien, cela ferait seulement semblant.
 *
 * Ce qui prouve vraiment, c'est un message envoye DEPUIS le compte Instagram
 * lie au nom : seul son titulaire peut le faire. L'ecran affiche alors le mot
 * de passage tire par le serveur, en grand, parce qu'il doit survivre a un
 * aller-retour vers une autre application.
 *
 * Sans compte lie, la demande part quand meme et un humain tranche. On le dit
 * franchement plutot que de laisser croire a une verification.
 */
export function Recuperation({ nom, surRetour }: { nom: string; surRetour: (code: string, nom: string) => void }) {
  const { N } = SprinterApp;
  const [indice, setIndice] = useState('');
  const [etat, setEtat] = useState<Etat | null>(null);
  const [occupe, setOccupe] = useState(false);
  const [copie, setCopie] = useState(false);

  const envoyer = async () => {
    if (!nom.trim()) return;
    setOccupe(true);
    const r = await demanderRecuperation(nom.trim(), indice);
    setOccupe(false); setEtat(r);
    if (r.etat === 'rendu') { saveName(r.name); surRetour(r.code, r.name); }
  };

  const verifier = async () => {
    setOccupe(true);
    const r = await etatRecuperation(nom.trim());
    setOccupe(false); setEtat(r);
    if (r.etat === 'rendu') { saveName(r.name); surRetour(r.code, r.name); }
  };

  const copierPhrase = async (phrase: string) => {
    try {
      await navigator.clipboard.writeText(phrase);
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* le mot reste affiche en grand */ }
  };

  return (
    <div className="rounded-xl border border-white/10 bg-black/25 p-3 flex flex-col gap-2.5">
      <div className="flex items-center gap-2">
        <LifeBuoy className="w-3.5 h-3.5 text-primary" />
        <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
          {N.t('rec_title')}
        </span>
      </div>

      {/* Rien de depose encore : on explique ce qui va se passer. */}
      {(!etat || etat.etat === 'reseau') && (
        <>
          <p className="text-[9px] md:text-[10px] text-muted-foreground leading-snug">
            {N.t('rec_name_ask')} <span className="text-foreground font-bold">{nom || '—'}</span>
          </p>
          <input
            value={indice}
            onChange={e => setIndice(e.target.value)}
            placeholder={N.t('rec_indice')}
            maxLength={280}
            className="bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-xs
                       text-foreground placeholder:text-muted-foreground
                       focus:outline-none focus:border-primary/50"
          />
          <button
            onClick={envoyer}
            disabled={!nom.trim() || occupe}
            className="px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                       bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                       transition-colors flex items-center justify-center gap-2"
          >
            {occupe && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {N.t('rec_send')}
          </button>
          {etat?.etat === 'reseau' && (
            <span className="text-[10px] text-destructive text-center">{N.t('score_save_fail')}</span>
          )}
        </>
      )}

      {etat?.etat === 'inconnu' && (
        <span className="text-[10px] text-destructive text-center">{N.t('rec_unknown')}</span>
      )}

      {etat?.etat === 'refuse' && (
        <span className="text-[10px] text-destructive text-center">{N.t('rec_refused')}</span>
      )}

      {/* La demande attend. Avec Instagram, il y a quelque chose a faire. */}
      {etat?.etat === 'attente' && (
        <>
          {etat.phrase && etat.insta ? (
            <>
              <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
                {N.t('rec_insta_title')}
              </span>
              <p className="text-[9px] md:text-[10px] text-muted-foreground leading-snug">
                {N.t('rec_insta_help', { c: '@' + etat.compte, i: '@' + etat.insta })}
              </p>
              <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex flex-col items-center gap-1.5">
                <span className="text-[9px] font-bold tracking-widest text-primary">
                  {N.t('rec_phrase')}
                </span>
                <span className="font-mono font-black text-base md:text-lg tracking-[0.15em] text-primary text-center break-all">
                  {etat.phrase}
                </span>
                <button
                  onClick={() => copierPhrase(etat.phrase as string)}
                  className="text-[10px] font-bold tracking-widest text-muted-foreground
                             hover:text-primary transition-colors flex items-center gap-1.5"
                >
                  {copie ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  {copie ? N.t('code_copied') : N.t('challenge_copy_code')}
                </button>
              </div>
              <a
                href={lienMessageJeu(etat.compte)}
                target="_blank" rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                           bg-primary hover:bg-primary/90 transition-colors
                           flex items-center justify-center gap-2"
              >
                <Instagram className="w-3.5 h-3.5" /> {N.t('rec_open')}
              </a>
            </>
          ) : (
            <>
              <span className="text-[10px] font-bold text-foreground">{N.t('rec_no_insta')}</span>
              <p className="text-[9px] md:text-[10px] text-muted-foreground leading-snug">
                {N.t('rec_no_insta_help')}
              </p>
            </>
          )}

          <span className="text-[9px] md:text-[10px] text-muted-foreground text-center">
            {N.t('rec_waiting')}
          </span>
          <button
            onClick={verifier}
            disabled={occupe}
            className="text-[10px] font-bold tracking-widest text-muted-foreground
                       hover:text-primary transition-colors flex items-center justify-center gap-1.5"
          >
            {occupe ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            {N.t('rec_check')}
          </button>
        </>
      )}

      {etat?.etat === 'rendu' && (
        <span className="text-xs font-bold text-primary text-center">{N.t('rec_done')}</span>
      )}
    </div>
  );
}
