import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, BarChart3, WifiOff } from 'lucide-react';
import {
  cleTableau, poserCleTableau, lireServerStats, type ServerStats,
} from '@/game/stats';

/**
 * La porte du tableau de bord.
 *
 * Le tableau s'ouvrait par `?stats` sur l'adresse publique du jeu, sans rien
 * demander. Ce n'etait pas un secret, c'etait une adresse devinable — et
 * `?stats` est le premier parametre que l'on essaie sur un jeu.
 *
 * Ce qui ferme reellement n'est pas cette porte : c'est la route. `/stats`
 * repond 404 a qui n'a pas la cle, si bien que masquer l'ecran ne cache plus
 * seulement l'ecran. Un `curl` sur l'adresse ne rend plus rien non plus. Cette
 * porte-ci n'est que la facon de presenter la cle, et le seul endroit du jeu
 * qui sache qu'il existe un tableau derriere.
 *
 * La cle n'est pas verifiee par une route dediee : on tente la lecture, et la
 * reponse tranche. C'est aussi ce qui evite un aller-retour — la tentative qui
 * valide la cle est celle qui rapporte les chiffres.
 *
 * Ce n'est pas la cle d'administration. Celle-la refait les classements de tout
 * le monde ; on ne la promene pas dans un navigateur pour consulter des
 * compteurs. Voir `estTableau` dans worker/src/acces.js.
 */
export function PorteTableau({ enfant }: { enfant: (stats: ServerStats) => React.ReactNode }) {
  const [etat, setEtat] = useState<'verifie' | 'demande' | 'ouvert' | 'panne'>('verifie');
  const [stats, setStats] = useState<ServerStats | null>(null);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  // Au chargement : la cle rangee ouvre-t-elle encore ? Comme pour la porte du
  // canal de test, on ne met rien en cache — le jour ou la cle change sur le
  // Worker, la porte se referme au prochain chargement.
  useEffect(() => {
    let vivant = true;
    if (!cleTableau()) { setEtat('demande'); return; }
    lireServerStats().then(r => {
      if (!vivant) return;
      if (r.etat === 'ok') { setStats(r.stats); setEtat('ouvert'); }
      // Une panne reseau ne condamne pas la cle : on le dit, et on la garde.
      else if (r.etat === 'panne') setEtat('panne');
      else { setErreur('cette clé n’ouvre plus'); setEtat('demande'); }
    });
    return () => { vivant = false; };
  }, []);

  const entrer = async () => {
    const c = saisie.trim();
    if (!c) return;
    setOccupe(true); setErreur('');
    const r = await lireServerStats(c);
    setOccupe(false);
    if (r.etat === 'panne') { setErreur('serveur injoignable'); return; }
    if (r.etat === 'refuse') { setErreur('clé refusée'); return; }
    // On ne range que la cle qui a ouvert.
    poserCleTableau(c);
    setStats(r.stats); setEtat('ouvert');
  };

  if (etat === 'ouvert' && stats) return <>{enfant(stats)}</>;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6
                    bg-gradient-to-b from-[#080a12] via-[#05070d] to-[#080a12]">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 justify-center">
          <BarChart3 className="w-4 h-4 text-white/70" />
          <h1 className="font-display font-black tracking-widest text-white/80 text-sm">
            SPRINTER — TABLEAU DE BORD
          </h1>
        </div>

        {etat === 'verifie' ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : etat === 'panne' ? (
          <>
            <div className="flex flex-col items-center gap-2 py-4">
              <WifiOff className="w-5 h-5 text-white/30" />
              <p className="text-center text-xs text-white/50">
                Serveur injoignable. La clé est conservée.
              </p>
            </div>
            <button
              onClick={() => { setEtat('verifie'); location.reload(); }}
              className="w-full py-3 rounded-xl font-bold tracking-wide text-xs
                         text-black bg-white/90 hover:bg-white transition-colors"
            >
              RÉESSAYER
            </button>
          </>
        ) : (
          <>
            <p className="text-center text-xs text-white/50 leading-relaxed">
              Les chiffres du jeu ne sont pas publics.
            </p>
            <div className="flex gap-2">
              <input
                value={saisie}
                onChange={e => setSaisie(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') entrer(); }}
                placeholder="CLÉ"
                type="password"
                autoComplete="off" autoCorrect="off" spellCheck={false}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-3
                           text-sm font-mono tracking-[0.3em] text-center text-white
                           placeholder:tracking-normal placeholder:font-sans placeholder:text-white/25
                           focus:outline-none focus:border-white/30"
              />
              <button
                onClick={entrer}
                disabled={occupe || !saisie.trim()}
                className="shrink-0 px-4 rounded-xl font-bold tracking-wide text-xs
                           text-black bg-white/90 hover:bg-white
                           disabled:opacity-30 transition-colors flex items-center gap-2"
              >
                {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                ENTRER
              </button>
            </div>
            {erreur && <p className="text-center text-xs text-red-400">{erreur}</p>}
            <a href={import.meta.env.BASE_URL}
               className="text-center text-[10px] text-white/25 hover:text-white/50 transition-colors">
              retourner au jeu
            </a>
          </>
        )}
      </motion.div>
    </div>
  );
}
