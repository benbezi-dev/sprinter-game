import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Hand, Eye, Flag, XCircle, Timer } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { SalleRelais, type EtatRelais, type Zone } from '@/game/salle-relais';

/**
 * La course de relais, cote joueur.
 *
 * Quatre ecrans qui n'en font qu'un, parce qu'ils se suivent sans qu'on ait le
 * temps de naviguer : l'attente en zone, la tape du temoin, la vue spectateur
 * pendant les portions des autres, et la fin.
 *
 * Le client n'arbitre rien. Il annonce sa marque, sa position, sa tape et son
 * chrono ; c'est la salle qui date les deux tapes sur son horloge, verifie la
 * geometrie et tranche. Un passage rate elimine toute l'equipe — laisser ce
 * jugement a l'un des deux telephones serait laisser une equipe se faire
 * eliminer par la latence de son coequipier.
 */

const chrono = (ms: number) => (ms / 1000).toFixed(2) + ' s';
const NOTES = ['raté', 'correct', 'parfait'];

/* -------------------------------------------------- l'attente en zone */

/**
 * Le placement de la marque.
 *
 * Trente metres de zone, et le choix de l'endroit ou l'on se place dedans.
 * Devant, on part plus tot et l'on prend de la vitesse, mais on risque de
 * sortir de la zone avant que le temoin n'arrive. Derriere, on est sur de
 * l'avoir, et l'on part a l'arret.
 */
function Marque({ zone, valeur, onChange }: {
  zone: Zone; valeur: number; onChange: (d: number) => void;
}) {
  const { N } = SprinterApp;
  const part = (valeur - zone.debut) / (zone.fin - zone.debut);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] tracking-widest text-muted-foreground">
          {N.t('relais_ta_marque')}
        </span>
        <span className="font-mono text-xs tabular-nums text-emerald-300">
          {Math.round(valeur - zone.debut)} m
        </span>
      </div>
      <input
        type="range" min={zone.debut} max={zone.fin} step={0.5} value={valeur}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-emerald-400"
        aria-label={N.t('relais_ta_marque')}
      />
      <div className="relative h-6 rounded-lg bg-black/40 border border-white/10 overflow-hidden">
        <div className="absolute inset-y-0 left-0 bg-emerald-400/15"
             style={{ width: `${part * 100}%` }} />
        <div className="absolute inset-y-0 w-0.5 bg-emerald-400"
             style={{ left: `${part * 100}%` }} />
        <span className="absolute inset-0 flex items-center justify-between px-2
                         text-[8px] tracking-widest text-muted-foreground/70">
          <span>{N.t('relais_zone_debut')}</span>
          <span>{N.t('relais_zone_fin')}</span>
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground leading-snug">
        {N.t('relais_marque_conseil')}
      </p>
    </div>
  );
}

/* ------------------------------------------------------- la vue spectateur */

function Spectateur({ e, monRelais }: { e: EtatRelais; monRelais: number }) {
  const { N } = SprinterApp;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="flex items-center gap-1.5 text-[10px] tracking-widest text-muted-foreground">
        <Eye className="w-3 h-3" /> {N.t('relais_spectateur')}
      </span>
      {e.joueurs.map(j => {
        const porte = j.relais === e.porteur;
        const moi = j.relais === monRelais;
        return (
          <div key={j.id}
               className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg border
                 ${porte ? 'border-emerald-400/50 bg-emerald-400/[0.10]'
                   : moi ? 'border-white/20 bg-black/30' : 'border-white/6 bg-black/20'}`}>
            <span className="font-mono text-[10px] w-4 shrink-0 text-muted-foreground">{j.relais}</span>
            <span className="flex-1 text-[11px] font-bold truncate text-foreground">{j.nom}</span>
            {porte && <span className="text-[8px] tracking-widest text-emerald-300">{N.t('relais_porte')}</span>}
            <span className="font-mono text-[10px] tabular-nums text-muted-foreground shrink-0">
              {Math.round(j.d)} m
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- la fin */

function Fin({ e, onFermer }: { e: EtatRelais; onFermer: () => void }) {
  const { N } = SprinterApp;
  const rate = !!e.elimine;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-6 bg-[#05070d]">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-sm flex flex-col items-center gap-4">
        {rate ? <XCircle className="w-7 h-7 text-destructive" />
              : <Flag className="w-7 h-7 text-emerald-400" />}
        <h2 className={`font-display font-black tracking-widest text-center text-xl
                        ${rate ? 'text-destructive' : 'text-emerald-400'}`}>
          {N.t(rate ? 'relais_elimine' : 'relais_arrivee')}
        </h2>

        {rate ? (
          <p className="text-center text-xs text-white/60 leading-relaxed max-w-[28ch]">
            {N.t('relais_elimine_pourquoi', {
              r: String(e.elimine!.relais), c: e.elimine!.raison,
            })}
          </p>
        ) : (
          <p className="font-mono font-black text-4xl tabular-nums text-emerald-300">
            {chrono(e.total || 0)}
          </p>
        )}

        {/* Les trois passages, notes. C'est la que se gagne un relais : trois
            transmissions parfaites valent plus qu'un relayeur rapide. */}
        {e.passes?.length > 0 && (
          <div className="w-full flex flex-col gap-1.5 mt-1">
            <span className="text-[9px] tracking-widest text-muted-foreground text-center">
              {N.t('relais_passages')}
            </span>
            {e.passes.map((p, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg
                                      border border-white/8 bg-black/25">
                <span className="font-mono text-[10px] text-muted-foreground">
                  {p.de} → {p.vers}
                </span>
                <span className="flex-1" />
                <span className={`text-[10px] font-bold tracking-widest
                  ${p.note >= 2 ? 'text-emerald-300' : p.note >= 1 ? 'text-primary' : 'text-destructive'}`}>
                  {NOTES[Math.max(0, Math.min(2, p.note))]}
                </span>
              </div>
            ))}
          </div>
        )}

        <button onClick={onFermer}
          className="mt-2 px-6 py-2.5 rounded-xl font-black font-display tracking-widest
                     text-background bg-emerald-400 text-sm">
          {N.t('champ_continue')}
        </button>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ l'ecran */

export function CourseRelais({ equipe, onQuitter }: {
  equipe: string; onQuitter: () => void;
}) {
  const { N } = SprinterApp;
  const [e, setE] = useState<EtatRelais | null>(null);
  const [pret, setPret] = useState(false);
  const [marque, setMarque] = useState(0);
  const [erreur, setErreur] = useState('');
  const salle = useRef<SalleRelais | null>(null);

  useEffect(() => {
    const s = new SalleRelais(equipe, {
      onEtat: setE,
      onDepart: (dansMs) => {
        // Le relayeur qui court est pilote par le moteur ; les autres
        // regardent. On ne lance la course chez soi que pour le premier.
        if (s.monRelais === 1) {
          SprinterApp.startLive(['100'], { levelIdx: 4, adversaire: '', autres: [] });
          SprinterApp.liveDepart(dansMs);
        }
      },
      onElimine: (raison) => setErreur(raison),
      onFerme: (r) => { if (r !== 'fermee') setErreur(r); },
    });
    salle.current = s;
    s.connecter();
    return () => { s.fermer(); };
  }, [equipe]);

  // La marque part de l'entree de la zone : c'est le placement le plus sur,
  // et c'est celui qu'on veut par defaut pour qui ne touche a rien.
  useEffect(() => {
    const z = salle.current?.maZone;
    if (z && marque === 0) setMarque(z.debut);
  }, [e]);

  if (!e) {
    return (
      <div className="bg-card/70 border border-white/10 rounded-2xl p-6 flex justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const mon = salle.current?.monRelais || 0;
  const zone = salle.current?.maZone || null;
  const partie = !!e.depart_a;
  const fini = e.total != null || !!e.elimine;
  const jeRecois = partie && mon === e.porteur + 1;
  // La tape ne s'offre que quand le porteur est dans ma zone : proposer le
  // bouton plus tot inviterait a taper dans le vide, et une tape hors zone
  // elimine l'equipe.
  const aPortee = jeRecois && zone && e.temoin_d >= zone.debut - 12;

  return (
    <>
      <AnimatePresence>
        {fini && <Fin e={e} onFermer={onQuitter} />}
      </AnimatePresence>

      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="bg-card/70 backdrop-blur-xl border border-emerald-400/30 rounded-2xl
                   p-4 md:p-5 shadow-2xl flex flex-col gap-4"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-bold tracking-widest text-emerald-400">
            {e.equipe}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            {N.t('relais_mon_rang', { n: String(mon) })}
          </span>
        </div>

        {/* Avant le depart : se placer, puis se declarer pret. */}
        {!partie && !fini && (
          <>
            {zone && mon > 1 && (
              <Marque zone={zone} valeur={marque}
                      onChange={d => { setMarque(d); salle.current?.marque(d); }} />
            )}
            {mon === 1 && (
              <p className="text-[11px] text-muted-foreground text-center leading-snug">
                {N.t('relais_premier')}
              </p>
            )}
            <div className="flex flex-col gap-1.5">
              {e.joueurs.map(j => (
                <div key={j.id} className={`flex items-center gap-2 px-3 py-2 rounded-xl border
                  ${j.pret ? 'border-emerald-400/40 bg-emerald-400/[0.08]' : 'border-white/10 bg-black/25'}`}>
                  <span className="font-mono text-[10px] w-4 text-muted-foreground">{j.relais}</span>
                  <span className="flex-1 text-xs font-bold truncate text-foreground">{j.nom}</span>
                  <span className={`text-[9px] tracking-widest
                    ${j.pret ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {N.t(j.pret ? 'live_ready' : 'live_notready')}
                  </span>
                </div>
              ))}
            </div>
            <button
              onClick={() => { const v = !pret; setPret(v); salle.current?.pret(v); }}
              disabled={e.joueurs.length < 4}
              className={`w-full py-3 rounded-xl font-black font-display tracking-widest
                disabled:opacity-40 disabled:pointer-events-none
                ${pret ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                       : 'bg-emerald-400 text-background'}`}>
              {N.t(pret ? 'live_unready' : 'live_go')}
            </button>
            {e.joueurs.length < 4 && (
              <p className="text-[10px] text-center text-muted-foreground">
                {N.t('relais_attend_equipe', { n: String(4 - e.joueurs.length) })}
              </p>
            )}
          </>
        )}

        {/* Pendant la course. */}
        {partie && !fini && (
          <>
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-xl
                            bg-black/30 border border-white/8">
              <span className="flex items-center gap-2 text-[10px] tracking-widest text-muted-foreground">
                <Timer className="w-3.5 h-3.5" /> {N.t('relais_temoin_a')}
              </span>
              <span className="font-mono text-sm font-bold tabular-nums text-emerald-300">
                {Math.round(e.temoin_d)} m
              </span>
            </div>

            {jeRecois ? (
              <button
                onPointerDown={() => salle.current?.temoin()}
                disabled={!aPortee}
                className={`w-full py-6 rounded-2xl font-black font-display tracking-widest text-lg
                  transition-colors ${aPortee
                    ? 'bg-emerald-400 text-background animate-pulse'
                    : 'bg-white/5 text-white/25 border border-white/10'}`}>
                <Hand className="w-6 h-6 mx-auto mb-1" />
                {N.t(aPortee ? 'relais_prends' : 'relais_attends_temoin')}
              </button>
            ) : mon === e.porteur ? (
              <button
                onPointerDown={() => salle.current?.temoin()}
                className="w-full py-6 rounded-2xl font-black font-display tracking-widest text-lg
                           bg-primary text-background">
                <Hand className="w-6 h-6 mx-auto mb-1" />
                {N.t('relais_donne')}
              </button>
            ) : (
              <Spectateur e={e} monRelais={mon} />
            )}
          </>
        )}

        {erreur && <p className="text-center text-xs text-destructive">{erreur}</p>}
        <button onClick={onQuitter}
                className="text-[10px] tracking-widest text-muted-foreground hover:text-foreground">
          {N.t('live_leave')}
        </button>
      </motion.div>
    </>
  );
}
