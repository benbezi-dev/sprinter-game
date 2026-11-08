// LE DUEL DES EPREUVES (08/11/2026) : 60, 200 ou 400 m en salle, quelle epreuve
// pour le Championnat de France du 19/12 ? 1 course finie en salle = 1 voix,
// 10 par jour au plus. Les regles et les dates vivent dans
// worker/src/duel-epreuves.js : la banderole ne s'affiche que si le serveur
// dit le duel ouvert, il n'y a donc pas de date a tenir ici.
import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MONTEE } from '@/lib/mouvement';
import { SprinterApp } from '@/game/engine';
import { getDeviceId } from '@/game/leaderboard';

const API_BASE = 'https://sprinter-leaderboard.benbezi-sprinter.workers.dev';
const EPREUVES = ['60', '200s', '400s'] as const;
type Epreuve = typeof EPREUVES[number];
const NOM: Record<Epreuve, string> = { '60': '60 m', '200s': '200 m', '400s': '400 m' };

type Tableau = {
  ouvert: boolean; fin: number;
  epreuves: Record<Epreuve, { voix: number; joueurs: number }>;
  en_tete: Epreuve | null;
  voix_par_jour: number; mes_voix_du_jour: number;
};

function lire(): Promise<Tableau | null> {
  return fetch(`${API_BASE}/duel-epreuves?device_id=${encodeURIComponent(getDeviceId())}`)
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null);
}

/** « 12 j 4 h », ou « 3 h 05 » le dernier jour. */
function reste(ms: number, fr: boolean): string {
  const h = Math.floor(ms / 3600_000), j = Math.floor(h / 24);
  if (j >= 1) return fr ? `${j} j ${h % 24} h` : `${j}d ${h % 24}h`;
  const m = Math.floor((ms % 3600_000) / 60_000);
  return `${h} h ${String(m).padStart(2, '0')}`;
}

export function BanderoleEpreuves() {
  const fr = SprinterApp.N.getLang() === 'fr';
  const [t, setT] = useState<Tableau | null>(null);
  // relu a chaque retour a l'accueil (la banderole se remonte) et chaque minute
  useEffect(() => {
    let vivant = true;
    const maj = () => lire().then(d => { if (vivant) setT(d); });
    maj();
    const id = window.setInterval(maj, 60_000);
    return () => { vivant = false; window.clearInterval(id); };
  }, []);
  if (!t || !t.ouvert) return null;

  const total = EPREUVES.reduce((s, e) => s + t.epreuves[e].voix, 0);
  const plus = t.mes_voix_du_jour < t.voix_par_jour;
  const courir = (e: Epreuve) => SprinterApp.startOneShot([e] as any, { levelIdx: 4 });

  return (
    <motion.div {...MONTEE}
      className="w-full rounded-2xl border-2 border-primary/60 bg-card px-3 py-2.5 flex flex-col gap-2">
      <div className="flex flex-wrap items-baseline justify-between gap-x-2">
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase text-white/90 whitespace-nowrap">
          {fr ? 'Championnat de France · 19/12' : 'French Championship · 19/12'}
        </span>
        <span className="text-[9px] font-bold tracking-[0.1em] uppercase text-primary whitespace-nowrap">
          {fr ? `Fin du vote ${reste(Math.max(0, t.fin - Date.now()), fr)}` : `Vote ends ${reste(Math.max(0, t.fin - Date.now()), fr)}`}
        </span>
      </div>
      <span className="font-display font-black text-sm md:text-base leading-tight">
        {fr ? 'QUELLE ÉPREUVE ? 1 COURSE = 1 VOIX' : 'WHICH EVENT? 1 RACE = 1 VOTE'}
      </span>
      <div className="flex flex-col gap-1.5">
        {EPREUVES.map(e => {
          const v = t.epreuves[e].voix;
          const part = total ? Math.round((v / total) * 100) : 0;
          const tete = t.en_tete === e;
          return (
            <button key={e} onClick={() => courir(e)}
              aria-label={fr ? `Courir le ${NOM[e]} en salle, ${v} voix` : `Run the indoor ${NOM[e]}, ${v} votes`}
              className="relative w-full h-9 rounded-xl overflow-hidden border border-white/15 text-left active:scale-[0.98] transition-transform">
              <motion.div aria-hidden className={`absolute inset-y-0 left-0 ${tete ? 'bg-primary/45' : 'bg-white/15'}`}
                initial={{ width: 0 }} animate={{ width: `${part}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              <span className="relative h-full px-3 flex items-center justify-between gap-2">
                <span className={`font-black text-sm ${tete ? 'text-primary' : ''}`}>
                  {NOM[e]}{tete ? (fr ? ' · en tête' : ' · leading') : ''}
                </span>
                <span className="text-xs font-bold tabular-nums text-white/90">
                  {part} % · {fr ? 'COURIR' : 'RUN'} ›
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <span className="text-[10px] text-white/70">
        {plus
          ? (fr ? `Tes voix aujourd’hui : ${t.mes_voix_du_jour}/${t.voix_par_jour}` : `Your votes today: ${t.mes_voix_du_jour}/${t.voix_par_jour}`)
          : (fr ? `Tes ${t.voix_par_jour} voix du jour sont données. Reviens demain !` : `All ${t.voix_par_jour} votes used today. Come back tomorrow!`)}
      </span>
    </motion.div>
  );
}
