import React, { useEffect, useRef, useState } from 'react';
import { Mic, Square, Play, Send, Loader2, Check, Trash2 } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import {
  Enregistreur, poserMot, urlDeLaVoix, MAX_TEXTE, MAX_VOIX_MS,
  type EtatVoix,
} from '@/game/mot';

/**
 * Le mot du vainqueur : celui qui l'ecrit, et celui qui le recoit.
 *
 * Les deux moities vivent dans le meme fichier parce qu'elles sont un seul
 * geste vu des deux bouts. Les separer ferait deriver l'une de l'autre — un
 * jour la voix serait proposee d'un cote et plus jouable de l'autre.
 */

/* ------------------------------------------------------- ecrire son mot */

/**
 * Offert au vainqueur, et une seule fois.
 *
 * Deux facons de dire la meme chose : le texte, qui se lit sans son et se
 * relit ; la voix, qui porte le ton et ne se relit pas. On ne demande pas de
 * choisir d'avance — le champ est la, le bouton du micro aussi, et le premier
 * des deux qu'on utilise devient le mot.
 */
export function LaisserUnMot({ duel, adversaire, onPose }: {
  duel: string; adversaire: string; onPose?: () => void;
}) {
  const { N } = SprinterApp;
  const [texte, setTexte] = useState('');
  const [etat, setEtat] = useState<EtatVoix>('repos');
  const [ecoule, setEcoule] = useState(0);
  const [envoi, setEnvoi] = useState(false);
  const [pose, setPose] = useState(false);
  const [erreur, setErreur] = useState('');
  const enr = useRef<Enregistreur | null>(null);

  useEffect(() => {
    enr.current = new Enregistreur((e, ms) => { setEtat(e); setEcoule(ms); });
    // Le micro se rend au demontage s'il tourne encore : on ne laisse jamais
    // un voyant allume derriere soi.
    return () => { enr.current?.jeter(); };
  }, []);

  const envoyer = async () => {
    const t = texte.trim();
    const v = enr.current?.blob || null;
    if (!t && !v) return;
    setEnvoi(true); setErreur('');
    const r = await poserMot(duel, { texte: t || undefined, voix: v });
    setEnvoi(false);
    if (r.error) { setErreur(r.error); return; }
    setPose(true);
    onPose?.();
  };

  if (pose) {
    return (
      <p className="w-full text-center text-[11px] md:text-xs text-emerald-400
                    flex items-center justify-center gap-1.5">
        <Check className="w-3.5 h-3.5" />
        {N.t('mot_envoye', { n: adversaire })}
      </p>
    );
  }

  const enregistre = etat === 'enregistre';
  const prete = etat === 'prete';
  const reste = Math.max(0, Math.ceil((MAX_VOIX_MS - ecoule) / 1000));

  return (
    <div className="w-full flex flex-col gap-2 rounded-xl border border-white/10
                    bg-black/25 p-3">
      <span className="text-[9px] md:text-[10px] tracking-widest text-muted-foreground text-center">
        {N.t('mot_titre', { n: adversaire })}
      </span>

      {!prete && (
        <input
          value={texte}
          onChange={e => setTexte(e.target.value.slice(0, MAX_TEXTE))}
          placeholder={N.t('mot_placeholder')}
          maxLength={MAX_TEXTE}
          disabled={enregistre}
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3 py-2 text-sm
                     text-foreground placeholder:text-muted-foreground
                     focus:outline-none focus:border-primary/50 disabled:opacity-40"
        />
      )}

      <div className="flex items-center gap-2">
        {/* La voix : on appuie pour parler, on relache pour finir. Six
            secondes maximum, et le compte a rebours est visible — un
            enregistrement qui se coupe sans prevenir se refait toujours. */}
        {!prete ? (
          <button
            onClick={() => enregistre ? enr.current?.arreter() : enr.current?.demarrer()}
            className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl
                        font-bold tracking-widest text-[10px] md:text-xs transition-colors
                        ${enregistre ? 'bg-destructive text-background'
                          : 'bg-white/10 text-foreground hover:bg-white/15'}`}
          >
            {enregistre ? <Square className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            {enregistre ? `${reste} s` : N.t('mot_vocal')}
          </button>
        ) : (
          <>
            <button
              onClick={() => {
                const b = enr.current?.blob;
                if (b) new Audio(URL.createObjectURL(b)).play().catch(() => {});
              }}
              className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl
                         bg-white/10 text-foreground font-bold tracking-widest text-[10px] md:text-xs"
            >
              <Play className="w-3.5 h-3.5" /> {N.t('mot_ecouter')}
            </button>
            <button
              onClick={() => enr.current?.jeter()}
              aria-label={N.t('mot_refaire')}
              className="shrink-0 p-2 rounded-xl bg-white/5 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        <button
          onClick={envoyer}
          disabled={envoi || enregistre || (!texte.trim() && !prete)}
          className="flex-1 py-2 rounded-xl font-black font-display tracking-widest text-[11px] md:text-xs
                     text-background bg-primary hover:bg-primary/90 disabled:opacity-40
                     disabled:pointer-events-none flex items-center justify-center gap-1.5"
        >
          {envoi ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {N.t('mot_envoyer')}
        </button>
      </div>

      {etat === 'refuse' && (
        <p className="text-center text-[10px] text-muted-foreground">{N.t('mot_micro_refuse')}</p>
      )}
      {erreur && <p className="text-center text-[10px] text-destructive">{erreur}</p>}
    </div>
  );
}

/* ------------------------------------------------------ recevoir le mot */

/**
 * Ce que le vainqueur a laisse, montre au perdant.
 *
 * La voix ne part pas toute seule : les navigateurs refusent de jouer un son
 * sans un geste, et c'est aussi bien — on choisit d'ecouter quelqu'un qui vient
 * de vous battre. Une fois cette fenetre fermee, l'enregistrement est efface du
 * serveur et ne se rejoue plus.
 */
export function LireLeMot({ texte, voix, voixType, auteur }: {
  texte?: string | null; voix?: string | null; voixType?: string | null; auteur: string;
}) {
  const { N } = SprinterApp;
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!voix) return;
    let u = '';
    try { u = urlDeLaVoix(voix, voixType || 'audio/webm'); setUrl(u); }
    catch { setUrl(null); }
    return () => { if (u) URL.revokeObjectURL(u); };
  }, [voix, voixType]);

  if (!texte && !url) return null;

  return (
    <div className="w-full rounded-xl border border-destructive/30 bg-destructive/[0.07]
                    px-4 py-3 flex flex-col items-center gap-2">
      {texte && (
        <p className="text-sm md:text-base text-foreground text-center leading-snug">
          « {texte} »
        </p>
      )}
      {url && (
        <button
          onClick={() => { const a = new Audio(url); a.play().catch(() => {}); }}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10
                     text-foreground font-bold tracking-widest text-[10px] md:text-xs
                     hover:bg-white/15 transition-colors"
        >
          <Play className="w-3.5 h-3.5" /> {N.t('mot_ecouter_sa_voix')}
        </button>
      )}
      <span className="text-[10px] md:text-xs font-bold tracking-widest text-cyan-300
                       truncate max-w-full">
        {auteur}
      </span>
      {url && (
        <span className="text-[9px] text-muted-foreground text-center leading-snug">
          {N.t('mot_ephemere')}
        </span>
      )}
    </div>
  );
}
