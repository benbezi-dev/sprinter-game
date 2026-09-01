import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  KeyRound, Loader2, LifeBuoy, Instagram, Check, X, RotateCcw, WifiOff,
} from 'lucide-react';
import {
  lireFileRecuperations, trancherRecuperation, cleAdmin, poserCleAdmin,
  type DemandeRecuperation,
} from '@/game/identity';

/**
 * La file des demandes de recuperation, pour celui qui tranche.
 *
 * Cet ecran n'automatise rien, et c'est son interet : il pose cote a cote les
 * deux moities de la preuve — de quel compte Instagram le message doit venir,
 * et quel mot il doit porter — pour qu'il n'y ait plus qu'a les confronter a
 * la boite de reception du jeu. Tout le reste (anciennete du nom, nombre de
 * courses, derniere partie) sert au cas ou il n'y a pas de compte lie, la ou
 * la decision reste une appreciation.
 *
 * Il vit derriere la CLE D'ADMINISTRATION, pas celle du tableau de bord :
 * accepter une demande, c'est donner a quelqu'un les clefs d'un nom.
 */
export function FileRecuperations() {
  const [etat, setEtat] = useState<'verifie' | 'demande' | 'ouvert' | 'panne'>('verifie');
  const [demandes, setDemandes] = useState<DemandeRecuperation[]>([]);
  const [saisie, setSaisie] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);
  const [toutes, setToutes] = useState(false);

  const charger = async (cle?: string) => {
    const r = await lireFileRecuperations(cle, toutes);
    if (r.etat === 'ok') { setDemandes(r.demandes); setEtat('ouvert'); return true; }
    if (r.etat === 'panne') { setEtat('panne'); return false; }
    return false;
  };

  useEffect(() => {
    if (!cleAdmin()) { setEtat('demande'); return; }
    charger().then(ok => { if (!ok) setEtat(e => (e === 'panne' ? e : 'demande')); });
    // `toutes` recharge la file : c'est le meme ecran, pas un autre.
  }, [toutes]);

  const entrer = async () => {
    const c = saisie.trim();
    if (!c) return;
    setOccupe(true); setErreur('');
    const ok = await charger(c);
    setOccupe(false);
    if (!ok) { setErreur('clé refusée'); return; }
    poserCleAdmin(c);
  };

  const trancher = async (id: number, accepte: boolean) => {
    setOccupe(true);
    const ok = await trancherRecuperation(id, accepte);
    setOccupe(false);
    if (ok) charger();
  };

  const date = (ms: number | null) =>
    ms == null ? '—' : new Date(ms).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: '2-digit' });

  if (etat !== 'ouvert') {
    return (
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-6
                      bg-gradient-to-b from-[#080a12] via-[#05070d] to-[#080a12]">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="w-full max-w-sm flex flex-col gap-4">
          <div className="flex items-center gap-2 justify-center">
            <LifeBuoy className="w-4 h-4 text-white/70" />
            <h1 className="font-display font-black tracking-widest text-white/80 text-sm">
              SPRINTER — RÉCUPÉRATIONS
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
                <p className="text-center text-xs text-white/50">Serveur injoignable.</p>
              </div>
              <button onClick={() => { setEtat('verifie'); location.reload(); }}
                      className="w-full py-3 rounded-xl font-bold tracking-wide text-xs
                                 text-black bg-white/90 hover:bg-white transition-colors">
                RÉESSAYER
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-xs text-white/50 leading-relaxed">
                Accepter une demande donne les clefs d’un nom. Clé d’administration.
              </p>
              <div className="flex gap-2">
                <input
                  value={saisie}
                  onChange={e => setSaisie(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') entrer(); }}
                  placeholder="CLÉ" type="password"
                  autoComplete="off" autoCorrect="off" spellCheck={false}
                  className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-3
                             text-sm font-mono tracking-[0.3em] text-center text-white
                             placeholder:tracking-normal placeholder:font-sans placeholder:text-white/25
                             focus:outline-none focus:border-white/30"
                />
                <button onClick={entrer} disabled={occupe || !saisie.trim()}
                        className="shrink-0 px-4 rounded-xl font-bold tracking-wide text-xs
                                   text-black bg-white/90 hover:bg-white disabled:opacity-30
                                   transition-colors flex items-center gap-2">
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

  return (
    <div className="min-h-[100dvh] w-full bg-[#060913] text-white font-sans overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 md:py-12 flex flex-col gap-5">
        <header className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <LifeBuoy className="w-4 h-4 text-[#f8cd4a]" />
            <h1 className="font-display font-black tracking-widest text-sm">RÉCUPÉRATIONS</h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setToutes(t => !t)}
                    className="text-[10px] font-bold tracking-widest text-white/40 hover:text-white transition-colors">
              {toutes ? 'EN ATTENTE SEULEMENT' : 'TOUT L’HISTORIQUE'}
            </button>
            <button onClick={() => charger()}
                    className="text-white/40 hover:text-white transition-colors">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </header>

        {demandes.length === 0 && (
          <p className="text-xs text-white/40 py-8 text-center">Aucune demande.</p>
        )}

        {demandes.map(d => (
          <div key={d.id}
               className="rounded-2xl bg-white/[0.04] border border-white/10 p-4 flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3 flex-wrap">
              <span className="font-display font-black text-lg">{d.nom}</span>
              <span className={`text-[10px] font-bold tracking-widest ${
                d.etat === 'attente' ? 'text-[#f8cd4a]'
                : d.etat === 'accepte' ? 'text-emerald-400' : 'text-red-400'}`}>
                {d.etat.toUpperCase()}
              </span>
            </div>

            {/* La preuve, quand il y en a une : les deux moities cote a cote. */}
            {d.insta && d.phrase ? (
              <div className="rounded-xl border border-[#f8cd4a]/30 bg-[#f8cd4a]/10 p-3 flex flex-col gap-1.5">
                <span className="text-[9px] font-bold tracking-widest text-[#f8cd4a] flex items-center gap-1.5">
                  <Instagram className="w-3 h-3" /> UN MESSAGE À @{d.compte} DOIT VENIR DE
                </span>
                <a href={`https://instagram.com/${d.insta}`} target="_blank" rel="noopener noreferrer"
                   className="font-mono text-sm text-white hover:text-[#f8cd4a] transition-colors">
                  @{d.insta}
                </a>
                <span className="text-[9px] font-bold tracking-widest text-[#f8cd4a] mt-1">
                  ET PORTER LE MOT
                </span>
                <span className="font-mono font-black text-base tracking-[0.12em] text-white break-all">
                  {d.phrase}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-white/40 leading-snug">
                Aucun compte Instagram lié à ce nom — rien à vérifier, la décision
                repose sur les éléments ci-dessous.
              </p>
            )}

            {d.indice && (
              <p className="text-[11px] text-white/70 italic leading-snug border-l-2 border-white/15 pl-3">
                « {d.indice} »
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px]">
              {[
                ['NOM CRÉÉ LE', date(d.nom_cree_le)],
                ['COURSES', String(d.courses)],
                ['DERNIÈRE', date(d.derniere_course)],
                ['APPAREILS', String(d.appareils)],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-col">
                  <span className="text-white/35 tracking-widest font-bold">{k}</span>
                  <span className="font-mono text-white/80">{v}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-3 flex-wrap">
              <span className="text-[10px] text-white/30 font-mono">
                demandé le {date(d.cree_le)} · appareil {d.appareil}…
              </span>
              {d.etat === 'attente' && (
                <div className="flex gap-2">
                  <button onClick={() => trancher(d.id, false)} disabled={occupe}
                          className="px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest
                                     text-red-300 bg-red-500/10 border border-red-500/30
                                     hover:bg-red-500/20 disabled:opacity-40 transition-colors
                                     flex items-center gap-1.5">
                    <X className="w-3 h-3" /> REFUSER
                  </button>
                  <button onClick={() => trancher(d.id, true)} disabled={occupe}
                          className="px-3 py-2 rounded-xl text-[10px] font-bold tracking-widest
                                     text-black bg-white/90 hover:bg-white disabled:opacity-40
                                     transition-colors flex items-center gap-1.5">
                    <Check className="w-3 h-3" /> ACCEPTER
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
