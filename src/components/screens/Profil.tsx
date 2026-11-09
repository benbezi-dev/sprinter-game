import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Cloud, KeyRound, Settings, Copy, Check, Loader2, Eye, EyeOff } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { VOILE, PANNEAU } from '@/lib/mouvement';
import { savedCode, paysDe } from '@/game/identity';
import { derniereSauvegarde, envoyerProfil } from '@/game/profil';
import { useJeu, epreuvesDuJeu } from '@/game/jeux';
import { Drapeau } from '@/components/Insignes';
import { RecordTuile } from './RecordPerso';
import { LiaisonQR } from './LiaisonQR';
import { OUVRIR_PARAMETRES } from './Parametres';

function coursesTerminees(): number {
  try {
    const h = JSON.parse(localStorage.getItem('sprinter_history') || '[]');
    return Array.isArray(h) ? h.length : 0;
  } catch { return 0; }
}

function quand(ms: number, lang: string): string {
  if (!ms) return '';
  return new Date(ms).toLocaleString(lang === 'en' ? 'en-GB' : 'fr-FR',
    { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

/**
 * Le profil du joueur : ce que le jeu sait de lui, rassemble en une fenetre.
 * Chaque morceau existait deja, eparpille (nom a l'accueil, records et code
 * dans TOP 500 > MES COURSES, sauvegarde invisible) ; rien n'est recalcule ici.
 * Modifier le nom, le pays ou Instagram rouvre le panneau d'identite habituel.
 */
export function Profil({ nom, onFermer, onModifier }: { nom: string; onFermer: () => void; onModifier: () => void }) {
  const { N } = SprinterApp;
  const jeu = useJeu();
  const [pays, setPays] = useState<string | null>(null);
  const sauve = derniereSauvegarde(); // relue a chaque rendu : jamais d'heure perimee
  const [envoi, setEnvoi] = useState<'repos' | 'envoi' | 'ok' | 'ko'>('repos');
  const [voirCode, setVoirCode] = useState(false);
  const [copie, setCopie] = useState(false);
  const code = savedCode();

  useEffect(() => { paysDe(nom).then(p => setPays(p.pays)); }, [nom]);

  const sauver = async () => {
    setEnvoi('envoi');
    const avant = derniereSauvegarde();
    await envoyerProfil();
    const apres = derniereSauvegarde();
    setEnvoi(apres > avant ? 'ok' : 'ko');
  };
  const copier = async () => {
    try { await navigator.clipboard.writeText(code); setCopie(true); setTimeout(() => setCopie(false), 1500); }
    catch { setVoirCode(true); }
  };

  return (
    <motion.div {...VOILE} onClick={onFermer}
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md pointer-events-auto
                 px-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto bg-card/95 border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col gap-4">
        <h2 className="font-black font-display tracking-tight text-primary text-xl text-center">{N.t('prof_titre')}</h2>

        {/* Nom et drapeau */}
        <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
          {pays && <Drapeau pays={pays} className="text-2xl shrink-0" />}
          <span className="flex-1 min-w-0 font-black text-lg truncate">{nom}</span>
          <button type="button" onClick={onModifier}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold hover:bg-white/10">
            <Pencil className="w-3.5 h-3.5" />{N.t('prof_modifier')}
          </button>
        </div>

        {/* Records et nombre de courses */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2 px-0.5">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary">{N.t('prof_records')}</span>
            <span className="text-[11px] text-muted-foreground">{N.t('prof_courses', { n: coursesTerminees() })}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {epreuvesDuJeu(jeu).map(r => <RecordTuile key={r} race={r} />)}
          </div>
        </div>

        {/* Sauvegarde sur le serveur */}
        <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
          <Cloud className="w-5 h-5 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0 text-xs leading-tight">
            <div className="text-muted-foreground">{N.t('prof_sauve')}</div>
            <div className="font-bold">{!code ? N.t('prof_non_reserve') : sauve ? quand(sauve, N.getLang()) : N.t('prof_jamais')}</div>
          </div>
          {!code ? (
            <button type="button" onClick={onModifier}
                    className="shrink-0 rounded-lg bg-primary text-background px-2.5 py-1.5 text-xs font-bold">
              {N.t('prof_reserver')}
            </button>
          ) : <button type="button" onClick={sauver} disabled={envoi === 'envoi'}
                  className="shrink-0 flex items-center gap-1 rounded-lg bg-primary text-background px-2.5 py-1.5 text-xs font-bold disabled:opacity-60">
            {envoi === 'envoi' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : envoi === 'ok' ? <Check className="w-3.5 h-3.5" /> : null}
            {envoi === 'ok' ? N.t('prof_sauve_ok') : envoi === 'ko' ? N.t('prof_sauve_ko') : N.t('prof_sauver')}
          </button>}
        </div>

        {/* Code de recuperation : masque par defaut, c'est la cle du nom */}
        {code && (
          <div className="flex flex-col gap-1 rounded-xl bg-secondary/50 px-3 py-2.5">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground flex-1">{N.t('prof_code')}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="flex-1 font-mono font-bold tracking-[0.3em] text-base">{voirCode ? code : '•'.repeat(code.length)}</span>
              <button type="button" onClick={() => setVoirCode(v => !v)} aria-label={voirCode ? 'masquer' : 'afficher'}
                      className="p-1.5 rounded-lg hover:bg-white/10">
                {voirCode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button type="button" onClick={copier}
                      className="flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1.5 text-xs font-bold hover:bg-white/10">
                {copie ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copie ? N.t('prof_copie') : N.t('prof_copier')}
              </button>
            </div>
            <span className="text-[10px] text-muted-foreground">{N.t('prof_code_note')}</span>
          </div>
        )}

        {/* Relier un autre telephone (QR) */}
        <LiaisonQR nom={nom} />

        <button type="button" onClick={() => { onFermer(); window.dispatchEvent(new Event(OUVRIR_PARAMETRES)); }}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-bold text-sm bg-secondary/60 hover:bg-secondary transition-colors">
          <Settings className="w-4 h-4" />{N.t('reg_titre')}
        </button>

        <button type="button" onClick={onFermer}
                className="w-full py-3 rounded-xl font-black font-display text-lg tracking-widest text-background bg-primary hover:bg-primary/90
                           transition-all border-b-4 border-[var(--primaire-fonce)] active:border-b-0 active:translate-y-1">
          {N.t('close')}
        </button>
      </motion.div>
    </motion.div>
  );
}
