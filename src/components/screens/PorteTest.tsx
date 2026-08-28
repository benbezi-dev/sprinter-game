import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { KeyRound, Loader2, FlaskConical, LogOut } from 'lucide-react';
import { codeAcces, poserCode, oublierCode, verifierCode } from '@/game/canal';

/**
 * La porte de la version de test.
 *
 * Elle n'existe que sur le canal de test : en production, la constante qui la
 * conditionne vaut false et le bundler retire ce fichier du build.
 *
 * Le code est reverifie a chaque lancement, jamais mis en cache comme un jeton
 * de session. C'est ce qui rend la revocation immediate : le jour ou un code est
 * retire, la personne qui l'avait ne repasse pas la porte au chargement suivant,
 * sans qu'on ait a faire expirer quoi que ce soit.
 *
 * Cette porte-ci est une porte, pas un coffre — le code du jeu est public et
 * quelqu'un de determine la contourne. Ce qui protege reellement est ailleurs :
 * sans code valide, le serveur refuse les routes reservees et, surtout, aucune
 * ecriture ne peut atteindre la base de production.
 */
export function PorteTest() {
  const [etat, setEtat] = useState<'verifie' | 'demande' | 'ouvert'>('verifie');
  const [saisie, setSaisie] = useState('');
  const [nom, setNom] = useState('');
  const [erreur, setErreur] = useState('');
  const [occupe, setOccupe] = useState(false);

  // Au lancement : le code range est-il encore valable ?
  useEffect(() => {
    const code = codeAcces();
    if (!code) { setEtat('demande'); return; }
    let vivant = true;
    verifierCode(code).then(r => {
      if (!vivant) return;
      if (r.ok) { setNom(r.nom || ''); setEtat('ouvert'); }
      else { oublierCode(); setErreur("cet accès a été retiré"); setEtat('demande'); }
    });
    return () => { vivant = false; };
  }, []);

  const entrer = async () => {
    const c = saisie.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (c.length < 4) return;
    setOccupe(true); setErreur('');
    const r = await verifierCode(c);
    setOccupe(false);
    if (!r.ok) { setErreur('code refusé'); return; }
    poserCode(c); setNom(r.nom || ''); setEtat('ouvert');
  };

  const sortir = () => {
    oublierCode(); setSaisie(''); setNom(''); setEtat('demande');
  };

  // Acces accorde : un simple bandeau, pour qu'on n'oublie jamais qu'on est
  // sur la version de test et pas sur le vrai jeu.
  if (etat === 'ouvert') {
    return (
      <div className="fixed top-0 left-0 right-0 z-[60] pointer-events-none flex justify-center"
           style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        <div className="pointer-events-auto mt-1 flex items-center gap-2 px-3 py-1
                        rounded-full bg-amber-400/15 border border-amber-400/40 backdrop-blur">
          <FlaskConical className="w-3 h-3 text-amber-300" />
          <span className="font-mono text-[9px] tracking-widest text-amber-200 uppercase">
            version de test{nom ? ` · ${nom}` : ''}
          </span>
          <button onClick={sortir} aria-label="quitter la version de test"
                  className="text-amber-300/60 hover:text-amber-200">
            <LogOut className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center px-6
                    bg-gradient-to-b from-[#080a12] via-[#05070d] to-[#080a12]">
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm flex flex-col gap-4"
      >
        <div className="flex items-center gap-2 justify-center">
          <FlaskConical className="w-4 h-4 text-amber-400" />
          <h1 className="font-display font-black tracking-widest text-amber-400 text-sm">
            SPRINTER — VERSION DE TEST
          </h1>
        </div>

        <p className="text-center text-xs text-white/50 leading-relaxed">
          Tout y est ouvert, et tout peut y casser. Les chronos joués ici
          n’entrent pas au classement du vrai jeu.
        </p>

        {etat === 'verifie' ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-white/30" />
          </div>
        ) : (
          <>
            <div className="flex gap-2">
              <input
                value={saisie}
                onChange={e => setSaisie(e.target.value.toUpperCase())}
                onKeyDown={e => { if (e.key === 'Enter') entrer(); }}
                placeholder="TON CODE"
                maxLength={12}
                autoCapitalize="characters" autoCorrect="off" spellCheck={false}
                className="flex-1 min-w-0 bg-black/40 border border-white/10 rounded-xl px-3 py-3
                           text-sm font-mono tracking-[0.3em] text-center text-white
                           placeholder:tracking-normal placeholder:font-sans placeholder:text-white/25
                           focus:outline-none focus:border-amber-400/50"
              />
              <button
                onClick={entrer}
                disabled={occupe || saisie.replace(/[^A-Z0-9]/g, '').length < 4}
                className="shrink-0 px-4 rounded-xl font-bold tracking-wide text-xs
                           text-black bg-amber-400 hover:bg-amber-300
                           disabled:opacity-30 transition-colors flex items-center gap-2"
              >
                {occupe ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
                ENTRER
              </button>
            </div>
            {erreur && <p className="text-center text-xs text-red-400">{erreur}</p>}
            <p className="text-center text-[10px] text-white/25">
              Pas de code ? Il se demande à celui qui tient le jeu.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}
