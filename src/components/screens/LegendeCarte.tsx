// LA CARTE DU VOYAGE — sur l'affiche de chaque etape de la Legende.
//
// D'ou l'on vient, ou l'on va, et comment : le trajet depuis l'etape d'avant
// se trace sur la carte du monde, et le vehicule de l'etape (velo, voiture,
// car, avion, fusee — etapes.ts) le parcourt. Les etapes deja courues restent
// marquees ; au bout, le lieu et le nom du boss, en surbrillance.
//
// La carte est une projection equirectangulaire toute bete (x = longitude,
// y = -latitude) : les terres viennent de world-atlas (Natural Earth, domaine
// public), converties une fois pour toutes en un seul trace
// (assets/legende/carte/terres.json). Pas de bibliotheque de projection : les
// coordonnees des lieux s'y posent telles quelles.
//
// Au-dela de la Terre : la ligne de Karman n'a pas de coordonnees — la fusee
// part de la ville du mondial et sort de la carte par le haut ; vers
// l'apotheose, la Terre s'eloigne et la fusee file vers une galaxie.

import React, { useEffect, useMemo, useState } from 'react';
import terres from '@/assets/legende/carte/terres.json';
import { ETAPES, DEPART, type Transport } from '@/game/legende/etapes';
import { lieuDeLEtape } from '@/game/legende/legende';

type Pt = [number, number];

// Le cadre : du 80e parallele nord au 62e sud, toutes longitudes.
const VB = { x: -180, y: -80, w: 360, h: 142 };
const xy = (geo: [number, number]): Pt => [geo[1], -geo[0]];

/** Un point de la courbe de Bezier quadratique a l'instant t, et sa tangente. */
function bezier(a: Pt, c: Pt, b: Pt, t: number): { p: Pt; ang: number } {
  const u = 1 - t;
  const p: Pt = [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]];
  const dx = 2 * u * (c[0] - a[0]) + 2 * t * (b[0] - c[0]);
  const dy = 2 * u * (c[1] - a[1]) + 2 * t * (b[1] - c[1]);
  return { p, ang: Math.atan2(dy, dx) * 180 / Math.PI };
}

// ---------------------------------------------------------------------------
// LES VEHICULES, dessines a la main, centres sur l'origine, nez vers +x.
// ---------------------------------------------------------------------------
function Velo() {
  return (
    <g strokeLinecap="round" strokeLinejoin="round">
      <circle cx={-3.4} cy={1.6} r={2.2} fill="none" stroke="#1B1B22" strokeWidth={0.7} />
      <circle cx={3.4} cy={1.6} r={2.2} fill="none" stroke="#1B1B22" strokeWidth={0.7} />
      <path d="M-3.4 1.6 L-0.6 1.6 L1.6 -1.4 L-1.8 -1.4 Z M1.6 -1.4 L3.4 1.6 M-1.8 -1.4 L-2.4 -2.6"
            fill="none" stroke="#E5302C" strokeWidth={0.75} />
      <path d="M-3.2 -2.7 L-1.4 -2.7" stroke="#6B3E22" strokeWidth={0.9} />
      <path d="M1.6 -1.4 L1.2 -3 L2.4 -3.2" fill="none" stroke="#1B1B22" strokeWidth={0.6} />
      <rect x={2.2} y={-4.4} width={2.2} height={1.4} rx={0.3} fill="#C9A15B" />
    </g>
  );
}
function Voiture() {
  return (
    <g>
      <path d="M-5 1.2 L-5 -0.6 Q-4.6 -1.6 -3 -1.8 L-1.6 -3.4 Q-0.8 -4 1.2 -4 L2.6 -4 Q3.6 -3.8 4.2 -2 L5 -1.4 L5 1.2 Z"
            fill="#F6C343" stroke="#7A5A10" strokeWidth={0.35} />
      <path d="M-1.1 -2 L-0.2 -3.3 L1.2 -3.3 L1.2 -2 Z M1.9 -2 L1.9 -3.3 L2.7 -3.3 Q3.3 -3 3.6 -2 Z" fill="#9FD6F2" />
      <circle cx={-2.8} cy={1.3} r={1.2} fill="#1B1B22" /><circle cx={2.9} cy={1.3} r={1.2} fill="#1B1B22" />
      <circle cx={-2.8} cy={1.3} r={0.45} fill="#C8CCD4" /><circle cx={2.9} cy={1.3} r={0.45} fill="#C8CCD4" />
    </g>
  );
}
function Car() {
  return (
    <g>
      <rect x={-7} y={-4} width={14} height={5.6} rx={1.1} fill="#F4F4F2" stroke="#5A6070" strokeWidth={0.35} />
      <rect x={-7} y={-0.6} width={14} height={0.8} fill="#2F7BE0" />
      <rect x={-7} y={0.25} width={14} height={0.55} fill="#F08A2B" />
      {[-5.6, -3.4, -1.2, 1.0, 3.2].map(x => <rect key={x} x={x} y={-3.2} width={1.8} height={1.9} rx={0.3} fill="#9FD6F2" />)}
      <rect x={5.4} y={-3.2} width={1.2} height={2.6} rx={0.3} fill="#9FD6F2" />
      <circle cx={-4.2} cy={1.7} r={1.2} fill="#1B1B22" /><circle cx={4.2} cy={1.7} r={1.2} fill="#1B1B22" />
    </g>
  );
}
function Avion() {
  // vu de dessus, nez vers +x
  return (
    <g>
      <path d="M-6 -0.7 L4.6 -0.8 Q6.4 -0.6 6.6 0 Q6.4 0.6 4.6 0.8 L-6 0.7 Q-6.6 0 -6 -0.7 Z" fill="#F7F7F5" stroke="#5A6070" strokeWidth={0.3} />
      <path d="M0.6 -0.7 L-2.4 -6 L-1.2 -6 L2.8 -0.7 Z M0.6 0.7 L-2.4 6 L-1.2 6 L2.8 0.7 Z" fill="#E9ECF1" stroke="#5A6070" strokeWidth={0.3} />
      <path d="M-4.8 -0.6 L-6.2 -2.6 L-5.4 -2.6 L-3.8 -0.6 Z M-4.8 0.6 L-6.2 2.6 L-5.4 2.6 L-3.8 0.6 Z" fill="#E9ECF1" stroke="#5A6070" strokeWidth={0.3} />
      <path d="M-6 -0.1 L5 -0.1" stroke="#2F7BE0" strokeWidth={0.45} />
    </g>
  );
}
function Fusee({ t }: { t: number }) {
  // nez vers +x ; la flamme vacille
  const f = 2.6 + Math.sin(t * 60) * 0.6;
  return (
    <g>
      <path d={`M-4.6 -0.9 L${-4.6 - f} 0 L-4.6 0.9 Z`} fill="#FFB43A" />
      <path d={`M-4.6 -0.5 L${-4.6 - f * 0.6} 0 L-4.6 0.5 Z`} fill="#FFF1B0" />
      <path d="M-4.6 -1.6 L2.8 -1.6 Q5.6 -1.2 6.4 0 Q5.6 1.2 2.8 1.6 L-4.6 1.6 Z" fill="#F7F7F5" stroke="#5A6070" strokeWidth={0.3} />
      <path d="M3.6 -1.45 Q5.6 -1.1 6.4 0 Q5.6 1.1 3.6 1.45 Z" fill="#E5302C" />
      <path d="M-4.6 -1.6 L-6.2 -3.4 L-2.6 -1.6 Z M-4.6 1.6 L-6.2 3.4 L-2.6 1.6 Z" fill="#E5302C" />
      <circle cx={1} cy={0} r={0.75} fill="#9FD6F2" stroke="#5A6070" strokeWidth={0.25} />
    </g>
  );
}
const VEHICULES: Record<Transport, (p: { t: number }) => React.ReactElement> = {
  velo: () => <Velo />, voiture: () => <Voiture />, car: () => <Car />, avion: () => <Avion />,
  fusee: ({ t }) => <Fusee t={t} />,
};
// Les vehicules au sol restent droits (retournes s'ils vont vers la gauche) ;
// l'avion et la fusee suivent leur trajectoire.
const SUIT_LA_COURBE: Record<Transport, boolean> = { velo: false, voiture: false, car: false, avion: true, fusee: true };

// ---------------------------------------------------------------------------

export function CarteDuVoyage({ rang, teinte, boss }: { rang: number; teinte: string; boss: string }) {
  const e = ETAPES[rang];
  const lieu = lieuDeLEtape(rang);
  const avant = rang === 0 ? DEPART : lieuDeLEtape(rang - 1);
  // La derniere ville sur Terre (le mondial) : d'ou part la fusee de Karman.
  const villeTerrestre = useMemo(() => {
    for (let r = rang - 1; r >= 0; r--) { const l = lieuDeLEtape(r); if (l.geo) return l; }
    return DEPART;
  }, [rang]);
  const espace = rang === ETAPES.length - 1;

  const [a, b, c] = useMemo((): [Pt, Pt, Pt] => {
    let depart = avant.geo ? xy(avant.geo) : xy(villeTerrestre.geo!);
    // vers l'apotheose, la Terre est reduite en bas a gauche (voir le <g>) :
    // la fusee part de la ville du mondial, la ou elle est dessinee
    if (espace) depart = [-120 + 0.32 * depart[0], 40 + 0.32 * depart[1]];
    let arrivee: Pt;
    if (lieu.geo) arrivee = xy(lieu.geo);
    else if (espace) arrivee = [138, -50];                       // la galaxie
    else arrivee = [depart[0] + 18, VB.y - 14];                  // hors de la carte, par le haut
    // le controle de la courbe : au-dessus du milieu, d'autant plus que c'est loin
    const dist = Math.hypot(arrivee[0] - depart[0], arrivee[1] - depart[1]);
    // (borne au cadre : l'arc vers la galaxie sortait par le haut)
    const ctrl: Pt = [(depart[0] + arrivee[0]) / 2,
                      Math.max(VB.y + 4, Math.min(depart[1], arrivee[1]) - Math.max(6, dist * 0.28))];
    return [depart, ctrl, arrivee];
  }, [avant, lieu, villeTerrestre, espace]);

  // Le trajet se parcourt en deux secondes et demie, puis le vehicule attend.
  const [t, setT] = useState(0);
  const [horloge, setHorloge] = useState(0);
  useEffect(() => {
    let raf = 0; const t0 = performance.now();
    const pas = (now: number) => {
      const s = (now - t0) / 1000;
      setT(Math.min(1, Math.max(0, (s - 0.35) / 2.5)));
      setHorloge(s);
      raf = requestAnimationFrame(pas);
    };
    raf = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(raf);
  }, [rang]);
  const lisse = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  const { p, ang } = bezier(a, b, c, lisse);
  const Vehicule = VEHICULES[e.transport];
  const versLaGauche = c[0] < a[0];
  const rot = SUIT_LA_COURBE[e.transport] ? ang : 0;
  const echelle = 1.15;

  // les etapes deja courues, sur Terre
  const faites = Array.from({ length: rang }, (_, r) => lieuDeLEtape(r)).filter(l => l.geo);
  const route = `M${a[0]} ${a[1]} Q${b[0]} ${b[1]} ${c[0]} ${c[1]}`;
  // des etoiles fixes pour la nuit de l'espace
  const etoiles = useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const g = Math.imul(i + 7, 2654435761) >>> 0;
    return [VB.x + (g % 3600) / 10, VB.y + ((g >>> 12) % 1420) / 10, 0.25 + ((g >>> 24) % 5) / 10] as const;
  }), []);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-white/10"
         style={{ background: espace ? '#05040D' : 'linear-gradient(180deg, #0B1A33, #081224)' }}>
      <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} className="w-full block" role="img"
           aria-label={`${avant.nom} → ${lieu.nom}`}>
        {(espace || !lieu.geo) && etoiles.map(([x, y, r], i) => (
          <circle key={i} cx={x} cy={y} r={r * 0.5} fill="#FFFFFF" opacity={0.35 + 0.4 * Math.abs(Math.sin(horloge * 1.3 + i))} />
        ))}
        {/* la Terre ; vers l'apotheose elle s'eloigne en bas a gauche */}
        <g transform={espace ? 'translate(-120 40) scale(0.32)' : undefined}
           opacity={espace ? 0.9 : 1}>
          {espace && <ellipse cx={0} cy={-8} rx={190} ry={100} fill="#0E2A55" opacity={0.6} />}
          <path d={(terres as any).d || ''} fill="#24365C" stroke="#3E5A8A" strokeWidth={0.35} strokeLinejoin="round" />
        </g>
        {espace && (
          <g>
            <circle cx={c[0]} cy={c[1]} r={9} fill={teinte} opacity={0.18} />
            <circle cx={c[0]} cy={c[1]} r={4} fill={teinte} opacity={0.45} />
            <circle cx={c[0]} cy={c[1]} r={1.6} fill="#FFFFFF" />
          </g>
        )}
        {/* les etapes deja courues */}
        {!espace && faites.map(l => {
          const q = xy(l.geo!);
          return <circle key={l.cle} cx={q[0]} cy={q[1]} r={1.6} fill="#F6C343" stroke="#0B1A33" strokeWidth={0.5} />;
        })}
        {/* le trajet : en pointille, puis rempli a mesure qu'on avance */}
        <path d={route} fill="none" stroke="#FFFFFF" strokeOpacity={0.25} strokeWidth={0.8} strokeDasharray="2 2" />
        <path d={route} fill="none" stroke={teinte} strokeWidth={1.1} pathLength={1}
              strokeDasharray="1" strokeDashoffset={1 - lisse} strokeLinecap="round" />
        {/* l'arrivee */}
        {lieu.geo && (
          <g>
            <circle cx={c[0]} cy={c[1]} r={3 + 2.4 * Math.abs(Math.sin(horloge * 2.4))} fill={teinte} opacity={0.25} />
            <circle cx={c[0]} cy={c[1]} r={2.1} fill={teinte} stroke="#FFFFFF" strokeWidth={0.6} />
          </g>
        )}
        {/* le vehicule */}
        <g transform={`translate(${p[0]} ${p[1]}) rotate(${rot}) scale(${(!SUIT_LA_COURBE[e.transport] && versLaGauche ? -1 : 1) * echelle} ${echelle})`}>
          <Vehicule t={horloge} />
        </g>
      </svg>
      {/* le nom du boss, en surbrillance, sous la carte */}
      <div className="flex items-center justify-between px-3 py-1.5 text-[10px] tracking-[0.16em] font-bold">
        <span className="text-white/55 truncate">{avant.nom.toUpperCase()} → {lieu.nom.toUpperCase()}</span>
        <span className="shrink-0 ml-2 px-2 py-0.5 rounded-md"
              style={{ color: '#0B0B12', background: teinte, boxShadow: `0 0 12px ${teinte}AA` }}>
          {boss.toUpperCase()}
        </span>
      </div>
    </div>
  );
}
