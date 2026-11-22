import { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { Flag } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { VOILE, PANNEAU } from '@/lib/mouvement';
import { useRetour } from '@/hooks/use-retour';
import { getSavedName } from '@/game/leaderboard';
import { signaler, MOTIFS, type Motif } from '@/game/moderation';

type Contenu = { id: string; genre: string; cle: string; nom: string; texte: string };

type Props = {
  course: { edition: string; phase: string; numero: number };
  mot: { nom: string; texte: string | null; a_voix: boolean } | null;
  presentes: { cle?: string; nom: string; bulle?: string | null }[];
};

/**
 * Signaler une bulle ou le mot du vainqueur, sous le tableau d'arrivee : une
 * bulle ne reste que trois secondes au-dessus de son athlete, trop peu pour y
 * poser un bouton. Le meme composant sert le direct et le rejeu.
 */
export function SignalerChampionnat({ course, mot, presentes }: Props) {
  const { N } = SprinterApp;
  const [ouvert, setOuvert] = useState(false);

  const base = `${course.edition}:${course.phase}`;
  const moi = (getSavedName() || '').trim().toLowerCase();
  const contenus: Contenu[] = presentes.flatMap(p => (p.cle && p.bulle ? [{
    id: `champ-bulle:${base}:${p.cle}`, genre: N.t('mod_champ_bulle'),
    cle: p.cle, nom: p.nom, texte: `« ${p.bulle} »`,
  }] : []));
  if (mot && (mot.texte || mot.a_voix)) {
    contenus.unshift({
      id: `champ-mot:${base}:${course.numero}`, genre: N.t('mod_champ_mot'),
      cle: mot.nom.trim().toLowerCase(), nom: mot.nom,
      texte: [mot.texte && `« ${mot.texte} »`, mot.a_voix && N.t('mod_champ_voix')].filter(Boolean).join(' · '),
    });
  }
  const signalables = contenus.filter(c => c.cle !== moi);
  if (!signalables.length) return null;

  return (
    <>
      <button type="button" onClick={() => setOuvert(true)}
        className="self-center min-h-11 px-3 flex items-center gap-1.5 text-[11px] text-white/60
                   hover:text-white transition-colors">
        <Flag className="w-3.5 h-3.5" aria-hidden /> {N.t('mod_champ_bouton')}
      </button>
      {ouvert && <Fenetre contenus={signalables} fermer={() => setOuvert(false)} />}
    </>
  );
}

function Fenetre({ contenus, fermer }: { contenus: Contenu[]; fermer: () => void }) {
  const { N } = SprinterApp;
  const [choisi, setChoisi] = useState<Contenu | null>(contenus.length === 1 ? contenus[0] : null);
  const [etat, setEtat] = useState<'repos' | 'envoi' | 'envoye' | 'rate'>('repos');
  useRetour(fermer);

  const envoyer = async (motif: Motif) => {
    if (!choisi) return;
    setEtat('envoi');
    setEtat(await signaler(choisi.id, motif) ? 'envoye' : 'rate');
  };
  const titre = N.t(etat === 'envoye' ? 'mod_envoye' : choisi ? 'mod_titre' : 'mod_champ_quoi');

  // dans body : le tableau d'arrivee est anime, un `fixed` y serait cadre sur lui
  return createPortal(
    <motion.div {...VOILE} onClick={e => { e.stopPropagation(); fermer(); }}
      className="fixed inset-0 z-[61] flex items-center justify-center bg-black/75 pointer-events-auto
                 pl-[max(env(safe-area-inset-left),1rem)] pr-[max(env(safe-area-inset-right),1rem)]">
      <motion.div {...PANNEAU} onClick={e => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label={titre}
        className="w-full max-w-sm max-h-[90dvh] overflow-y-auto overscroll-contain rounded-2xl border border-white/10
                   bg-card p-4 flex flex-col gap-2 text-foreground">
        <h2 role="status" className="text-sm font-bold text-center">{titre}</h2>

        {!choisi && contenus.map(c => (
          <button key={c.id} type="button" onClick={() => setChoisi(c)}
            className="min-h-11 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-left break-words">
            <span className="block text-[10px] text-muted-foreground">{c.genre} · {c.nom}</span>
            <span className="block text-sm">{c.texte}</span>
          </button>
        ))}

        {choisi && etat !== 'envoye' && (
          <>
            <p className="text-xs text-center text-muted-foreground break-words">{choisi.nom} · {choisi.texte}</p>
            <div className="grid grid-cols-2 gap-2">
              {MOTIFS.map(m => (
                <button key={m} type="button" autoFocus={m === MOTIFS[0]}
                  disabled={etat === 'envoi'} onClick={() => { void envoyer(m); }}
                  className="min-h-11 px-2 rounded-xl bg-white/10 hover:bg-white/15 text-sm disabled:opacity-50">
                  {N.t('mod_' + m)}
                </button>
              ))}
            </div>
            {etat === 'rate' && (
              <p role="alert" className="text-xs text-center text-destructive">{N.t('mod_champ_rate')}</p>
            )}
            <p className="text-[11px] text-center text-muted-foreground">{N.t('mod_champ_lu')}</p>
          </>
        )}

        <button type="button" onClick={fermer} className="min-h-11 text-sm text-muted-foreground hover:text-foreground">
          {N.t(etat === 'envoye' ? 'close' : 'mod_annuler')}
        </button>
      </motion.div>
    </motion.div>,
    document.body,
  );
}
