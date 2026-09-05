import React, { useState } from 'react';
import { SprinterApp } from '@/game/engine';
import { KeyRound, Copy, Check, Loader2, ShieldCheck, LifeBuoy } from 'lucide-react';
import { getSavedName, saveName } from '@/game/leaderboard';
import { claimName, linkDevice, savedCode, normaliserCode } from '@/game/identity';
import { LiaisonQR } from './LiaisonQR';
import { Recuperation } from './Recuperation';

/**
 * Identite du joueur : son nom, le code qui le lui reserve, et de quoi relier
 * un autre appareil. Pose dans MES COURSES, qui est deja l'espace personnel —
 * plutot que d'inventer un ecran de compte pour un jeu qui n'en a pas.
 */
export function IdentityPanel() {
  const { N } = SprinterApp;
  const [nom, setNom] = useState(getSavedName());
  const [code, setCode] = useState(savedCode());
  const [voirCode, setVoirCode] = useState(false);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'pris' | 'est_un_code' | 'erreur'>('repos');
  const [copie, setCopie] = useState(false);
  // Le nom auquel appartient le code que le joueur vient de coller dans le
  // champ du nom. On le garde pour pouvoir lui proposer la liaison d'un geste.
  const [nomDuCode, setNomDuCode] = useState('');
  const [perdu, setPerdu] = useState(false);

  const [autreCode, setAutreCode] = useState('');
  const [lien, setLien] = useState<'' | 'envoi' | 'lie' | 'mauvais' | 'inconnu' | 'erreur'>('');
  // Le nom qu'ouvre le code presente, quand ce n'est pas celui qu'on demande :
  // un code appartient a UN nom, et se rebaptiser en tire un nouveau.
  const [codeOuvre, setCodeOuvre] = useState('');

  const reserver = async () => {
    const n = nom.trim();
    if (!n) return;
    setEtat('envoi');
    const r = await claimName(n);
    if (r.etat === 'reserve') {
      saveName(r.name); setNom(r.name); setCode(r.code); setVoirCode(true); setEtat('repos');
    } else if (r.etat === 'pris') setEtat('pris');
    else if (r.etat === 'est_un_code') {
      // Le code devient ce qu'il aurait toujours du etre : la preuve, pas le
      // pseudo. On le deplace dans le champ prevu pour lui, et on remet le
      // vrai nom dans celui du nom.
      setAutreCode(normaliserCode(nom));
      setNomDuCode(r.nom);
      setNom(r.nom);
      setEtat('est_un_code');
    }
    else setEtat('erreur');
  };

  const relier = async (nomVise?: string) => {
    const n = (nomVise ?? nom).trim();
    if (!n || !autreCode.trim()) return;
    setLien('envoi'); setCodeOuvre('');
    const r = await linkDevice(n, autreCode);
    if (r.etat === 'lie') {
      saveName(n); setNom(n); setCode(normaliserCode(autreCode));
      setVoirCode(true); setLien('lie'); setEtat('repos');
    } else if (r.etat === 'mauvais_code') {
      setLien('mauvais');
      // Ce code n'ouvre pas ce nom-la, mais il en ouvre peut-etre un autre.
      setCodeOuvre(r.autreNom && r.autreNom !== n ? r.autreNom : '');
    }
    else if (r.etat === 'inconnu') setLien('inconnu');
    else setLien('erreur');
  };

  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie(true); setTimeout(() => setCopie(false), 1800);
    } catch { /* presse-papiers refuse : le code reste lisible */ }
  };

  return (
    <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 md:p-4 shadow-2xl flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <KeyRound className="w-4 h-4 text-primary" />
        <h3 className="text-[10px] md:text-xs font-bold tracking-widest text-primary">
          {N.t('id_title')}
        </h3>
      </div>

      <div className="flex gap-2">
        <input
          value={nom}
          onChange={e => { setNom(e.target.value); setEtat('repos'); setLien(''); }}
          placeholder={N.t('your_name')}
          maxLength={20}
          className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2 text-sm
                     text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
        />
        <button
          onClick={reserver}
          disabled={!nom.trim() || etat === 'envoi'}
          className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                     bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                     transition-colors flex items-center gap-2"
        >
          {etat === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          {code ? N.t('id_show') : N.t('id_reserve')}
        </button>
      </div>

      {/* Le code, revele a la demande : c'est la preuve d'appartenance. */}
      {code && voirCode && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 flex flex-col items-center gap-2">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-primary">
            {N.t('id_code_title')}
          </span>
          <span className="font-mono font-black text-2xl md:text-3xl tracking-[0.3em] text-primary pl-[0.3em]">
            {code}
          </span>
          <button
            onClick={copier}
            className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-primary
                       transition-colors flex items-center gap-1.5"
          >
            {copie ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copie ? N.t('code_copied') : N.t('challenge_copy_code')}
          </button>
          <p className="text-[9px] md:text-[10px] text-muted-foreground text-center leading-snug">
            {N.t('id_code_note')}
          </p>
        </div>
      )}
      {code && !voirCode && (
        <button onClick={() => setVoirCode(true)}
                className="text-[10px] font-bold tracking-widest text-muted-foreground hover:text-primary
                           transition-colors flex items-center gap-1.5 self-start">
          <ShieldCheck className="w-3 h-3" /> {N.t('id_show')}
        </button>
      )}

      {/* Nom deja pris : on ne bloque pas, on explique et on propose le code. */}
      {(etat === 'pris' || etat === 'est_un_code' || lien) && (
        <div className="rounded-xl border border-white/10 bg-black/25 p-3 flex flex-col gap-2">
          {etat === 'pris' && (
            <>
              <span className="text-xs font-bold text-destructive text-center">{N.t('id_taken')}</span>
              <span className="text-[10px] text-muted-foreground text-center">{N.t('id_taken_help')}</span>
            </>
          )}
          {etat === 'est_un_code' && (
            <>
              <span className="text-xs font-bold text-primary text-center">{N.t('id_is_code')}</span>
              <span className="text-[10px] text-muted-foreground text-center">
                {N.t('id_is_code_help', { n: nomDuCode })}
              </span>
            </>
          )}
          {lien !== 'lie' && (
            <div className="flex gap-2">
              <input
                value={autreCode}
                onChange={e => {
                  setAutreCode(normaliserCode(e.target.value));
                  setLien(''); setCodeOuvre('');
                }}
                placeholder={N.t('id_code_title')}
                maxLength={10}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                className="flex-1 min-w-0 bg-black/30 border border-white/10 rounded-xl px-3 py-2
                           text-sm font-mono tracking-[0.25em] text-center text-foreground
                           placeholder:tracking-normal placeholder:font-sans placeholder:text-muted-foreground
                           focus:outline-none focus:border-primary/50"
              />
              <button
                onClick={() => relier()}
                disabled={!autreCode.trim() || lien === 'envoi'}
                className="shrink-0 px-4 py-2 rounded-xl font-bold tracking-wide text-xs text-background
                           bg-primary hover:bg-primary/90 disabled:opacity-40 disabled:pointer-events-none
                           transition-colors flex items-center gap-2"
              >
                {lien === 'envoi' && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {N.t('id_link')}
              </button>
            </div>
          )}
          {lien === 'lie' && (
            <span className="text-xs font-bold text-primary text-center">
              {N.t('id_linked', { n: nom.trim() })}
            </span>
          )}
          {lien === 'mauvais' && <span className="text-[10px] text-destructive text-center">{N.t('id_bad_code')}</span>}
          {/* Ce code ouvre un AUTRE nom : on le dit, et on l'y relie d'un
              geste, plutot que de laisser croire le code mort. */}
          {lien === 'mauvais' && codeOuvre && (
            <>
              <span className="text-[10px] text-muted-foreground text-center">
                {N.t('id_code_autre', { n: codeOuvre })}
              </span>
              <button
                onClick={() => relier(codeOuvre)}
                className="self-center px-4 py-2 rounded-xl font-bold tracking-wide text-[10px]
                           text-background bg-primary hover:bg-primary/90 transition-colors"
              >
                {N.t('id_is_code_do', { n: codeOuvre })}
              </button>
            </>
          )}
          {lien === 'inconnu' && <span className="text-[10px] text-destructive text-center">{N.t('id_unknown')}</span>}
          {(lien === 'erreur' || etat === 'erreur') && (
            <span className="text-[10px] text-destructive text-center">{N.t('score_save_fail')}</span>
          )}
        </div>
      )}

      {/* Un nom a nous : on peut relier un autre telephone sans rien dicter. */}
      {code && nom.trim() && etat !== 'pris' && etat !== 'est_un_code' && (
        <LiaisonQR nom={nom.trim()} />
      )}

      {/* La porte de secours : plus de code, plus d'appareil relie. */}
      {perdu ? (
        <Recuperation
          nom={nom.trim()}
          surRetour={(c, n) => {
            setCode(c); setNom(n); setVoirCode(true);
            setPerdu(false); setEtat('repos'); setLien('');
          }}
        />
      ) : (
        (etat === 'pris' || lien === 'mauvais' || lien === 'inconnu') && (
          <button onClick={() => setPerdu(true)}
                  className="text-[10px] font-bold tracking-widest text-muted-foreground
                             hover:text-primary transition-colors flex items-center gap-1.5 self-start">
            <LifeBuoy className="w-3 h-3" /> {N.t('rec_lost')}
          </button>
        )
      )}

      {/* Comment retrouver ses chronos depuis un autre telephone. */}
      {!code && etat !== 'pris' && etat !== 'est_un_code' && (
        <div className="flex flex-col gap-1">
          <span className="text-[9px] md:text-[10px] font-bold tracking-widest text-muted-foreground">
            {N.t('id_link_title')}
          </span>
          <p className="text-[9px] md:text-[10px] text-muted-foreground/80 leading-snug">
            {N.t('id_link_help')}
          </p>
        </div>
      )}
    </div>
  );
}
