// Calque decoratif d'Halloween, pose en fond de l'accueil (sous le menu, par
// App.tsx). Purement decoratif : pointer-events-none, aucune interaction.
//
// Charge en lazy derriere HALLOWEEN_OUVERT (App.tsx) : hors saison, il sort du
// build comme le reste du mode. Tout est en SVG/CSS en ligne — aucune image a
// telecharger, pour ne rien couter aux telephones lents. Les animations ne
// touchent que transform et opacity, et se figent sous prefers-reduced-motion
// (voir index.css, classes hw-*).

const BATS = [
  { left: '12%', top: '18%', scale: 0.8, delay: '0s', dur: '7s' },
  { left: '72%', top: '12%', scale: 1.1, delay: '1.4s', dur: '9s' },
  { left: '44%', top: '28%', scale: 0.6, delay: '3s', dur: '8s' },
];

const STARS = [
  { left: '18%', top: '10%', d: '0s' },
  { left: '30%', top: '22%', d: '1.1s' },
  { left: '58%', top: '8%', d: '2.2s' },
  { left: '82%', top: '26%', d: '0.6s' },
  { left: '90%', top: '14%', d: '1.7s' },
  { left: '8%', top: '30%', d: '2.6s' },
];

function Bat({ scale }: { scale: number }) {
  // Deux ailes qui battent autour d'un corps central.
  return (
    <svg width={38 * scale} height={20 * scale} viewBox="0 0 38 20" fill="#0a0410" aria-hidden>
      <g className="hw-bat-wing" style={{ transformOrigin: '19px 10px' }}>
        <path d="M19 10 C13 2 8 3 3 1 C6 6 4 9 1 11 C7 11 10 9 13 13 C15 11 17 11 19 13 Z" />
        <path d="M19 10 C25 2 30 3 35 1 C32 6 34 9 37 11 C31 11 28 9 25 13 C23 11 21 11 19 13 Z" />
      </g>
      <ellipse cx="19" cy="10" rx="3" ry="4" />
    </svg>
  );
}

function Pumpkin({ size = 64, flip = false }: { size?: number; flip?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden
         style={{ transform: flip ? 'scaleX(-1)' : undefined }}>
      {/* tige */}
      <path d="M31 14 C30 8 33 6 36 7 C33 8 33 11 34 14 Z" fill="#4b7a2b" />
      {/* corps : trois lobes */}
      <g>
        <ellipse cx="32" cy="38" rx="22" ry="20" fill="#e8721c" />
        <ellipse cx="20" cy="38" rx="12" ry="19" fill="#f08a2e" />
        <ellipse cx="44" cy="38" rx="12" ry="19" fill="#f08a2e" />
        <ellipse cx="32" cy="38" rx="11" ry="20" fill="#ff9a3c" />
      </g>
      {/* visage sculpte, allume de l'interieur */}
      <g fill="#fff0b8">
        <path d="M20 32 L28 36 L20 40 Z" />
        <path d="M44 32 L36 36 L44 40 Z" />
        <path d="M24 46 h4 l2 3 l3 -3 h4 l-2 5 h-9 Z" />
      </g>
    </svg>
  );
}

export function HalloweenDecor() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none select-none" aria-hidden>
      {/* Voile de nuit : la piste de jour passe sous un ciel sombre violet, plus
          dense en haut, qui s'eclaircit vers le bas ou brille la lueur orange. */}
      <div className="absolute inset-0" style={{
        background:
          'linear-gradient(180deg, rgba(8,4,20,0.94) 0%, rgba(20,10,38,0.82) 42%, rgba(30,12,40,0.6) 72%, rgba(60,22,20,0.45) 100%)',
      }} />
      {/* halo general plus clair autour de la lune */}
      <div className="absolute inset-0" style={{
        background: 'radial-gradient(60% 45% at 80% 16%, rgba(255,214,150,0.22), transparent 70%)',
      }} />

      {/* Etoiles qui scintillent */}
      {STARS.map((s, i) => (
        <div key={i} className="hw-twinkle absolute rounded-full bg-amber-100"
             style={{ left: s.left, top: s.top, width: 3, height: 3, animationDelay: s.d }} />
      ))}

      {/* Lune */}
      <div className="hw-float absolute" style={{ right: '9%', top: '7%' }}>
        <div className="rounded-full" style={{
          width: 86, height: 86,
          background: 'radial-gradient(circle at 38% 34%, #fff6df 0%, #ffe9b8 55%, #e9c98b 100%)',
          boxShadow: '0 0 40px 14px rgba(255,224,160,0.45), 0 0 120px 40px rgba(255,180,90,0.18)',
        }}>
          {/* crateres */}
          <div className="absolute rounded-full" style={{ left: 20, top: 24, width: 14, height: 14, background: 'rgba(210,180,120,0.5)' }} />
          <div className="absolute rounded-full" style={{ left: 46, top: 46, width: 20, height: 20, background: 'rgba(210,180,120,0.4)' }} />
          <div className="absolute rounded-full" style={{ left: 54, top: 20, width: 9, height: 9, background: 'rgba(210,180,120,0.45)' }} />
        </div>
      </div>

      {/* Toile d'araignee, coin haut-gauche */}
      <svg className="absolute" style={{ left: -6, top: -6 }} width="150" height="150" viewBox="0 0 150 150"
           fill="none" stroke="rgba(230,235,255,0.42)" strokeWidth="1.1" aria-hidden>
        <path d="M0 0 L150 0 M0 0 L0 150 M0 0 L110 110 M0 0 L150 70 M0 0 L70 150" />
        <path d="M30 0 Q22 22 0 30 M62 0 Q46 46 0 62 M96 0 Q72 72 0 96 M128 0 Q96 96 0 128" />
      </svg>
      {/* Toile d'araignee, coin haut-droit, avec une araignee suspendue */}
      <svg className="absolute" style={{ right: -6, top: -6 }} width="130" height="130" viewBox="0 0 130 130"
           fill="none" stroke="rgba(230,235,255,0.38)" strokeWidth="1.1" aria-hidden>
        <path d="M130 0 L0 0 M130 0 L130 130 M130 0 L30 100 M130 0 L0 60 M130 0 L70 130" />
        <path d="M100 0 Q110 20 130 28 M64 0 Q86 44 130 58 M34 0 Q66 70 130 92" />
      </svg>
      <div className="hw-sway absolute" style={{ left: '34%', top: 0, transformOrigin: 'top center' }}>
        <div style={{ width: 1, height: 70, background: 'rgba(230,235,255,0.4)', margin: '0 auto' }} />
        <svg width="26" height="22" viewBox="0 0 26 22" fill="#0a0410" aria-hidden>
          <ellipse cx="13" cy="12" rx="6" ry="7" />
          <circle cx="13" cy="5" r="3.2" />
          <g stroke="#0a0410" strokeWidth="1.4" fill="none">
            <path d="M8 8 L1 4 M8 11 L0 11 M8 14 L1 19" />
            <path d="M18 8 L25 4 M18 11 L26 11 M18 14 L25 19" />
          </g>
          <circle cx="11.4" cy="4.4" r="0.9" fill="#ff8a1e" />
          <circle cx="14.6" cy="4.4" r="0.9" fill="#ff8a1e" />
        </svg>
      </div>

      {/* Chauves-souris en vol */}
      {BATS.map((b, i) => (
        <div key={i} className="hw-drift absolute"
             style={{ left: b.left, top: b.top, animationDelay: b.delay, animationDuration: b.dur }}>
          <Bat scale={b.scale} />
        </div>
      ))}

      {/* Brume basse, lueur de citrouille */}
      <div className="absolute inset-x-0 bottom-0" style={{
        height: '34%',
        background: 'linear-gradient(0deg, rgba(255,120,30,0.28) 0%, rgba(120,40,20,0.12) 45%, transparent 100%)',
      }} />
      {/* Citrouilles, posees en bas */}
      <div className="hw-float absolute" style={{ left: '6%', bottom: '3%', animationDelay: '0.8s' }}>
        <Pumpkin size={78} />
      </div>
      <div className="hw-float absolute" style={{ right: '7%', bottom: '2%', animationDelay: '0s' }}>
        <Pumpkin size={58} flip />
      </div>
    </div>
  );
}
