import React, { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import { SOUFFLE, IMPACT, jouer } from '@/game/marques-son';

/* ---------------------------------------------------------------------------
   LE FACE-A-FACE — l'ouverture du duel des marques (demandee le 13/10/2026).

   « adidas apparait par la droite, Nike par la gauche, et le VS vient
   s'effondrer entre les deux pour marquer la confrontation. » Sur un ecran
   debout, deux noms cote a cote ne tiennent pas en grand : l'ecran se coupe
   donc en DIAGONALE, comme l'ecran de selection d'un jeu de combat — Nike
   occupe le haut et entre par la gauche, adidas le bas et entre par la
   droite. Le VS tombe du haut sur la ligne de partage.

   L'IMPACT (0,95 s) est ce qui fait la confrontation, et tout s'y accroche :
   l'ecran tremble, un eclair blanc, deux ondes de choc, la ligne de partage
   s'allume, des fissures partent du point de chute, des etincelles volent,
   les deux panneaux reculent sous le coup puis reviennent au contact. Le son
   suit la meme horloge (marques-son.ts) : un souffle par panneau, le coup du
   VS.

   2,9 s en tout, puis l'ecran s'ouvre en deux sur le tableau. Un toucher
   l'abrege. Personne ne le voit s'il a demande moins d'animations : le
   parent ne le monte pas (DuelMarques.tsx).

   Toujours aucun logo ni couleur de marque : Nike dans le jaune du jeu,
   adidas en blanc, comme sur le reste du duel.
--------------------------------------------------------------------------- */

const JAUNE = '#FFD426';
const BLANC = '#FFFFFF';
/** L'instant ou le VS touche la ligne, en secondes. */
const CHOC = 0.95;
const FIN = 2.9;

/** Un alea reproductible : la meme gerbe a chaque ouverture. */
function gerbe(n: number, graine: number) {
  let g = graine;
  const r = () => (g = (g * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, () => ({
    angle: r() * Math.PI * 2,
    dist: 90 + r() * 220,
    taille: 3 + r() * 6,
    duree: 0.45 + r() * 0.5,
    jaune: r() > 0.45,
  }));
}

/** Les fissures : des lignes brisees qui partent du centre. */
function fissures(n: number, graine: number) {
  let g = graine;
  const r = () => (g = (g * 16807) % 2147483647) / 2147483647;
  return Array.from({ length: n }, (_, i) => {
    const base = (i / n) * Math.PI * 2 + r() * 0.5;
    let x = 0, y = 0;
    const pts = ['0,0'];
    for (let k = 0; k < 4; k++) {
      const a = base + (r() - 0.5) * 0.9;
      const l = 22 + r() * 34;
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  });
}

/** Un panneau : le fond qui file, et le nom du camp. */
function Panneau({ cote, nom, couleur }: { cote: 'haut' | 'bas'; nom: string; couleur: string }) {
  const haut = cote === 'haut';
  // la diagonale : le haut descend a droite, le bas remonte a gauche
  const decoupe = haut
    ? 'polygon(0 0, 100% 0, 100% 42%, 0 58%)'
    : 'polygon(0 58%, 100% 42%, 100% 100%, 0 100%)';
  // chacun entre par son bord, touche, recule sous le choc du VS, revient au contact
  const delai = haut ? 0.05 : 0.3;
  const total = CHOC + 0.45 - delai;
  const depart = haut ? '-105%' : '105%';
  const recul = haut ? '-4%' : '4%';
  return (
    <motion.div className="absolute inset-0"
      style={{ clipPath: decoupe, WebkitClipPath: decoupe }}
      initial={{ x: depart }}
      animate={{ x: [depart, '0%', recul, '0%'] }}
      transition={{ duration: total, times: [0, 0.38 / total, (CHOC + 0.06 - delai) / total, 1],
                    ease: ['easeOut', 'easeOut', 'easeInOut'], delay: delai }}>
      {/* le fond : la teinte du camp, et des rayures qui filent dans le sens de l'entree */}
      <div className="absolute inset-0"
        style={{ background: haut
          ? `linear-gradient(160deg, rgba(255,212,38,0.38), rgba(255,212,38,0.08) 55%, rgba(0,0,0,0.6))`
          : `linear-gradient(340deg, rgba(255,255,255,0.30), rgba(255,255,255,0.06) 55%, rgba(0,0,0,0.6))` }} />
      <motion.div className="absolute -inset-[20%] opacity-30"
        style={{
          background: `repeating-linear-gradient(${haut ? 105 : 285}deg, transparent 0 22px, ${haut ? 'rgba(255,212,38,0.55)' : 'rgba(255,255,255,0.45)'} 22px 26px)`,
        }}
        animate={{ x: haut ? ['0%', '12%'] : ['0%', '-12%'] }}
        transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }} />
      {/* le nom */}
      <div className={`absolute inset-x-0 flex flex-col px-6 ${haut ? 'top-[14%] items-start' : 'bottom-[14%] items-end'}`}>
        <motion.span className="text-[13px] md:text-sm font-black tracking-[0.5em] text-white/80"
          initial={{ opacity: 0, x: haut ? -30 : 30 }} animate={{ opacity: 1, x: 0 }}
          transition={{ delay: delai + 0.3, duration: 0.3 }}>
          TEAM
        </motion.span>
        <span className="font-display font-black italic leading-[0.85] tracking-tight"
          style={{
            color: couleur, fontSize: 'clamp(64px, 22vw, 150px)',
            textShadow: `0 0 28px ${haut ? 'rgba(255,212,38,0.55)' : 'rgba(255,255,255,0.45)'}, 0 6px 0 rgba(0,0,0,0.45)`,
          }}>
          {nom}
        </span>
      </div>
    </motion.div>
  );
}

export default function FaceAFace({ onDone, fr }: { onDone: () => void; fr: boolean }) {
  const fini = useRef(false);
  const finir = () => { if (!fini.current) { fini.current = true; onDone(); } };
  const etincelles = useMemo(() => gerbe(28, 7), []);
  const lignes = useMemo(() => fissures(9, 13), []);

  useEffect(() => {
    jouer(SOUFFLE, 0.05, 0.5);
    jouer(SOUFFLE, 0.3, 0.5);
    jouer(IMPACT, CHOC, 0.9);
    try { navigator.vibrate?.([0, Math.round(CHOC * 1000), 60, 40, 30]); } catch { /* pas de vibreur */ }
    const t = setTimeout(finir, FIN * 1000);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Pose sur <body> : sous l'ecran du duel (z-50), il resterait sous les
  // bandeaux du jeu (installation...) au lieu de prendre tout l'ecran.
  return createPortal(
    <motion.div className="fixed inset-0 z-[1000] overflow-hidden bg-black select-none cursor-pointer"
      onClick={finir} role="presentation"
      initial={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.25 } }}>
      {/* tout ce qui tremble au choc */}
      <motion.div className="absolute inset-0"
        animate={{ x: [0, 0, -16, 14, -10, 8, -4, 2, 0], y: [0, 0, 10, -8, 6, -4, 2, -1, 0] }}
        transition={{ duration: 0.55, times: [0, 0.001, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1], delay: CHOC, ease: 'easeOut' }}>

        {/* la sortie : les deux panneaux repartent chacun par son bord */}
        <motion.div className="absolute inset-0"
          animate={{ x: [0, 0, '-110%'] }} transition={{ duration: FIN, times: [0, 0.86, 1], ease: 'easeIn' }}>
          <Panneau cote="haut" nom="NIKE" couleur={JAUNE} />
        </motion.div>
        <motion.div className="absolute inset-0"
          animate={{ x: [0, 0, '110%'] }} transition={{ duration: FIN, times: [0, 0.86, 1], ease: 'easeIn' }}>
          <Panneau cote="bas" nom="ADIDAS" couleur={BLANC} />
        </motion.div>

        {/* la ligne de partage, qui s'allume au choc */}
        <motion.div aria-hidden className="absolute left-1/2 top-1/2 h-[3px] w-[160vmax] -translate-x-1/2 -translate-y-1/2"
          style={{ rotate: '-9deg', background: 'linear-gradient(90deg, transparent, #fff 30%, #FFD426 50%, #fff 70%, transparent)',
                   boxShadow: '0 0 18px 4px rgba(255,212,38,0.8)' }}
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: [0, 0, 1, 1, 0], opacity: [0, 0, 1, 0.7, 0] }}
          transition={{ duration: FIN, times: [0, CHOC / FIN, (CHOC + 0.12) / FIN, 0.84, 0.92], ease: 'easeOut' }} />

        {/* le point de chute : ondes, fissures, etincelles */}
        <div className="absolute left-1/2 top-1/2 w-0 h-0">
          {[0, 0.09].map((d, i) => (
            <motion.div key={i} aria-hidden className="absolute rounded-full border-[3px]"
              style={{ width: 160, height: 160, left: -80, top: -80, borderColor: i ? JAUNE : BLANC }}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 0, 4.2], opacity: [0, 1, 0] }}
              transition={{ duration: 0.75, times: [0, 0.001, 1], delay: CHOC + d, ease: 'easeOut' }} />
          ))}
          <svg aria-hidden className="absolute overflow-visible" style={{ left: 0, top: 0 }} width="1" height="1">
            {lignes.map((p, i) => (
              <motion.polyline key={i} points={p} fill="none" stroke={i % 2 ? JAUNE : BLANC} strokeWidth={2.2}
                strokeLinecap="round" strokeLinejoin="round"
                style={{ filter: 'drop-shadow(0 0 4px rgba(255,212,38,0.9))' }}
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: [0, 1, 1], opacity: [0, 1, 0] }}
                transition={{ duration: 1.3, times: [0, 0.18, 1], delay: CHOC + 0.02, ease: 'easeOut' }} />
            ))}
          </svg>
          {etincelles.map((e, i) => (
            <motion.span key={i} aria-hidden className="absolute rounded-full"
              style={{ width: e.taille, height: e.taille, left: -e.taille / 2, top: -e.taille / 2,
                       background: e.jaune ? JAUNE : BLANC, boxShadow: `0 0 8px ${e.jaune ? JAUNE : BLANC}` }}
              initial={{ x: 0, y: 0, opacity: 0, scale: 1 }}
              animate={{
                x: [0, 0, Math.cos(e.angle) * e.dist], y: [0, 0, Math.sin(e.angle) * e.dist + 40],
                opacity: [0, 1, 0], scale: [1.4, 1.4, 0.3],
              }}
              transition={{ duration: e.duree, times: [0, 0.02, 1], delay: CHOC, ease: 'easeOut' }} />
          ))}
        </div>

        {/* LE VS : il tombe du haut, s'ecrase, se tasse, puis bat */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <motion.div
            initial={{ y: '-70vh', scale: 2.8, rotate: -14, opacity: 0 }}
            animate={{
              y: ['-70vh', '-70vh', '0vh', '0vh', '0vh'],
              scale: [2.8, 2.8, 1, 1, 6],
              rotate: [-14, -14, -6, -6, 0],
              opacity: [0, 1, 1, 1, 0],
            }}
            transition={{ duration: FIN, times: [0, 0.6 / FIN, CHOC / FIN, 0.86, 1], ease: ['linear', 'easeIn', 'linear', 'easeIn'] }}>
            {/* le tassement du choc, a part : il ne se melange pas a la chute */}
            <motion.div
              animate={{ scaleX: [1, 1, 1.35, 0.92, 1.04, 1], scaleY: [1, 1, 0.62, 1.1, 0.97, 1] }}
              transition={{ duration: 0.5, times: [0, 0.001, 0.18, 0.45, 0.7, 1], delay: CHOC }}>
              <motion.span className="block font-display font-black italic leading-none"
                style={{
                  fontSize: 'clamp(96px, 34vw, 210px)', color: '#fff',
                  WebkitTextStroke: '4px #000',
                  textShadow: '0 0 30px rgba(255,212,38,0.95), 0 0 70px rgba(255,212,38,0.6), 6px 8px 0 #000',
                }}
                animate={{ filter: ['brightness(1)', 'brightness(1)', 'brightness(2.2)', 'brightness(1)', 'brightness(1.35)', 'brightness(1)'] }}
                transition={{ duration: 1.5, times: [0, CHOC / 1.5 - 0.001, CHOC / 1.5, (CHOC + 0.2) / 1.5, (CHOC + 0.4) / 1.5, 1] }}>
                VS
              </motion.span>
            </motion.div>
          </motion.div>
        </div>

        {/* la phrase, sous le VS, une fois le choc passe */}
        <motion.p className="absolute left-0 right-0 top-[calc(50%+min(18vw,110px))] text-center text-[11px] md:text-xs font-black tracking-[0.45em] text-white"
          style={{ textShadow: '0 2px 8px #000' }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: [0, 0, 1, 1, 0], y: [10, 10, 0, 0, 0] }}
          transition={{ duration: FIN, times: [0, (CHOC + 0.3) / FIN, (CHOC + 0.55) / FIN, 0.84, 0.9] }}>
          {fr ? 'QUE LA BATAILLE COMMENCE' : 'LET THE BATTLE BEGIN'}
        </motion.p>
      </motion.div>

      {/* l'eclair blanc du choc, par-dessus tout et sans trembler */}
      <motion.div aria-hidden className="absolute inset-0 bg-white pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0, 0.85, 0] }}
        transition={{ duration: 0.4, times: [0, 0.001, 0.08, 1], delay: CHOC }} />
      {/* le vignetage, qui serre le cadre au moment du coup */}
      <motion.div aria-hidden className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.85) 100%)' }}
        animate={{ opacity: [0.6, 0.6, 1, 0.6] }}
        transition={{ duration: 0.9, times: [0, 0.001, 0.15, 1], delay: CHOC }} />
    </motion.div>,
    document.body,
  );
}
