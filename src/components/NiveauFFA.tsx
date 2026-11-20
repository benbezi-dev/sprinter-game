import React, { useState } from 'react';
import { SprinterApp } from '@/game/engine';
import {
  niveauFFA, entreeBaremeFFA, ligneBaremeFFA, NIVEAUX_FFA, ECHELONS_FFA, echelonDe,
  type EchelonFFA,
} from '@/game/bareme-ffa';

/**
 * Le niveau FFA d'une performance, là où le joueur lit son chrono.
 *
 * TROIS FORMES : la pastille (« N2 · 28 pts ») à côté d'un temps ; la ligne
 * d'arrivée qui ajoute l'étage et ce qui manque pour le niveau suivant ; et le
 * tableau du barème de l'épreuve, replié, qui situe la performance parmi les
 * 23 niveaux. Les trois lisent le même `niveauFFA` : un arrondi qui diffère
 * d'un écran à l'autre se remarquerait tout de suite.
 */

const fr = () => SprinterApp.N.getLang() !== 'en';

/** Une couleur par étage : or, argent-bleu, vert, cyan, gris. */
export const TEINTE_ECHELON: Record<EchelonFFA, string> = {
  international: 'text-amber-300 border-amber-300/60 bg-amber-300/15',
  national: 'text-sky-300 border-sky-300/50 bg-sky-300/10',
  interregional: 'text-emerald-300 border-emerald-300/50 bg-emerald-300/10',
  regional: 'text-cyan-200 border-cyan-200/40 bg-cyan-200/10',
  departemental: 'text-slate-300 border-slate-300/30 bg-slate-300/10',
};

function ecartTexte(cle: string, ecart: number): string {
  const sens = ligneBaremeFFA(cle)?.sens;
  const v = ecart.toFixed(2);
  const t = fr() ? v.replace('.', ',') : v;
  return sens === 'marque' ? `${t} m` : `${t} s`;
}

/** La pastille : « N2 · 28 pts ». Rien si l'épreuve n'a pas de barème. */
export function PastilleFFA({ cle, perf, compact = false, points = true }: {
  cle: string; perf: number | null | undefined; compact?: boolean; points?: boolean;
}) {
  const n = niveauFFA(cle, perf);
  if (n === undefined || perf == null) return null;
  const taille = compact ? 'text-[9px] px-1.5 py-0' : 'text-[10px] md:text-xs px-2 py-0.5';
  if (n === null) {
    return (
      <span className={`shrink-0 inline-flex items-center rounded border font-bold tracking-wider
                        text-muted-foreground border-white/10 ${taille}`}
            title={fr() ? 'Hors barème FFA' : 'Below the FFA scale'}>
        {fr() ? 'HB' : '—'}
      </span>
    );
  }
  return (
    <span className={`shrink-0 inline-flex items-center gap-1 rounded border font-black tracking-wider
                      tabular-nums ${TEINTE_ECHELON[n.echelon]} ${taille}`}
          title={`${fr() ? 'Barème FFA' : 'FFA scale'} : ${n.code} (${ECHELONS_FFA[n.echelon][fr() ? 'fr' : 'en']}) · ${n.points} pts`}>
      {n.code}{points && <span className="font-bold opacity-75">· {n.points} pts</span>}
    </span>
  );
}

/**
 * La ligne d'arrivée : le niveau atteint, son étage, et l'écart au suivant.
 * « N2 · 28 pts — National — N1 à 0,12 s »
 */
export function LigneNiveauFFA({ cle, perf }: { cle: string; perf: number | null | undefined }) {
  const n = niveauFFA(cle, perf);
  if (n === undefined || perf == null || !Number.isFinite(perf) || perf <= 0) return null;
  const f = fr();
  if (n === null) {
    const e = entreeBaremeFFA(cle, perf);
    return (
      <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-xs font-bold tracking-widest uppercase text-muted-foreground">
        <span>{f ? 'Hors barème FFA' : 'Below the FFA scale'}</span>
        {e && <span className="text-foreground/70">D7 {f ? 'à' : 'in'} {ecartTexte(cle, e.ecart)}</span>}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] sm:text-xs font-bold tracking-widest uppercase">
      <PastilleFFA cle={cle} perf={perf} />
      <span className="text-foreground/80">{ECHELONS_FFA[n.echelon][f ? 'fr' : 'en']}</span>
      {n.suivant
        ? <span className="text-foreground/60">{n.suivant.code} {f ? 'à' : 'in'} {ecartTexte(cle, n.suivant.ecart)}</span>
        : <span className="text-amber-300">{f ? 'sommet du barème' : 'top of the scale'}</span>}
    </div>
  );
}

/**
 * Le barème de l'épreuve, replié sous un bouton : les 23 niveaux, leur case,
 * leurs points, et la ligne du joueur surlignée.
 */
export function TableauBaremeFFA({ cle, perf }: { cle: string; perf?: number | null }) {
  const [ouvert, setOuvert] = useState(false);
  const ligne = ligneBaremeFFA(cle);
  if (!ligne) return null;
  const f = fr();
  const n = perf != null ? niveauFFA(cle, perf) : null;
  return (
    <div className="w-full bg-card/70 border border-white/10 rounded-2xl overflow-hidden">
      <button type="button" onClick={() => setOuvert(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-left">
        <span className="text-xs md:text-sm font-black tracking-widest uppercase text-foreground/90">
          {f ? 'Barème FFA' : 'FFA scoring table'} · {ligne.epreuve.replace('m', ' m')}
        </span>
        <span className="text-xs font-bold text-primary">{ouvert ? '−' : '+'}</span>
      </button>
      {ouvert && (
        <div className="px-3 pb-3">
          <div className="grid grid-cols-[auto_1fr_auto_auto] gap-x-0 gap-y-0.5 text-xs font-mono tabular-nums">
            {NIVEAUX_FFA.map((nv, i) => {
              const txt = ligne.textes[i];
              if (!txt) return null;
              const moi = n?.rang === i;
              const ech = echelonDe(nv.code);
              const debut = i === 0 || echelonDe(NIVEAUX_FFA[i - 1].code) !== ech;
              const cls = moi ? 'bg-primary/20 text-primary font-black' : 'text-foreground/80';
              return (
                <React.Fragment key={nv.code}>
                  {debut && (
                    <div className="col-span-4 mt-2 first:mt-0 text-[10px] font-sans font-bold tracking-widest uppercase text-muted-foreground">
                      {ECHELONS_FFA[ech][f ? 'fr' : 'en']}
                    </div>
                  )}
                  <span className={`pl-1.5 pr-3 rounded-l ${cls}`}>{nv.code}</span>
                  <span className={`pr-3 ${cls}`}>{txt}</span>
                  <span className={`text-right pr-3 ${cls}`}>{nv.points} pts</span>
                  <span className={`pr-1.5 rounded-r ${cls}`}>{moi ? (f ? '◀ toi' : '◀ you') : ''}</span>
                </React.Fragment>
              );
            })}
          </div>
          <p className="mt-3 text-[10px] leading-snug text-muted-foreground font-sans">
            {f
              ? "Barème Hommes du classement des clubs, Fédération Française d'Athlétisme. Un niveau est acquis dès que la performance égale sa case."
              : 'French Athletics Federation men’s club-ranking table. A level is earned as soon as the performance equals its mark.'}
          </p>
        </div>
      )}
    </div>
  );
}
