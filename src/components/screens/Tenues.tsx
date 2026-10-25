import React, { useEffect, useRef } from 'react';
import { Shirt } from 'lucide-react';
import { SprinterApp, SprinterI18N } from '@/game/engine';
import { TENUES, lookDeTenue, porterTenue, useVestiaire } from '@/game/vestiaire';
import { Repliable } from './Repliable';

/* ---------------------------------------------------------------------------
   LES TENUES — TOP 500 > MES COURSES > TENUES
   ---------------------------------------------------------------------------
   LE COUREUR EN GRAND (20/10, a la demande de l'auteur). En course, la camera
   tient huit couloirs : un maillot y fait quelques dizaines de pixels et une
   pointe de chaussure, trois. Une tenue qu'on ne voit pas ne se choisit pas —
   et ne se vendra pas. Ici, le coureur occupe toute la vignette, au palier de
   detail le plus fin, et tourne sur lui-meme : on voit le dos, le bandeau, le
   poignet, les pointes.

   LE MEME DESSIN QU'EN COURSE. Pas d'image a part : ce sont les volumes du jeu
   (personCapsules, drawFacetFigure — sprinter-app.js), tournes par le cap du
   coureur. Ce qu'on choisit ici est exactement ce qui court.

   Le doigt fait tourner le coureur ; lache, il reprend son tour tout seul.
--------------------------------------------------------------------------- */

const L = (p: [string, string]) => p[SprinterI18N.index()] || p[0];
const css = (c: number[]) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;

/** La vignette : le coureur en tenue, qui trottine sur place en tournant. */
function Apercu({ cle }: { cle: string }) {
  const toile = useRef<HTMLCanvasElement>(null);
  const tenue = useRef(cle);
  tenue.current = cle;

  useEffect(() => {
    const cv = toile.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const man: any = { look: lookDeTenue(tenue.current), stride: 0, v: 3.2, maxSpeed: 12,
                       fallAnim: 0, celebrate: 0, drivePitch: 0 };
    let cap = 0.5, tire: { x: number; cap: number } | null = null;
    let avant = performance.now(), id = 0;

    const image = (t: number) => {
      const dt = Math.min(0.05, (t - avant) / 1000); avant = t;
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = cv.clientWidth, h = cv.clientHeight;
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr);
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      // L'ombre au sol : sans elle le coureur flotte dans la vignette.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.9, w * 0.16, h * 0.035, 0, 0, Math.PI * 2); ctx.fill();

      man.look = lookDeTenue(tenue.current);
      man.stride += dt * 5.0;
      if (!tire) cap += dt * 0.7;
      // k : la demi-hauteur de reference du rendu (drawIcon) — le corps tient
      // dans les quatre cinquiemes de la vignette.
      const k = h * 0.40;
      const A = SprinterApp;
      const caps = A.personCapsules(man, cap, 0, false, false, A.niveauDetail(k));
      A.drawFacetFigure(ctx, caps, w / 2, h * 0.9, k, true);
      id = requestAnimationFrame(image);
    };
    id = requestAnimationFrame(image);

    const bas = (e: PointerEvent) => { tire = { x: e.clientX, cap }; cv.setPointerCapture(e.pointerId); };
    const bouge = (e: PointerEvent) => { if (tire) cap = tire.cap + (e.clientX - tire.x) * 0.02; };
    const haut = () => { tire = null; };
    cv.addEventListener('pointerdown', bas);
    cv.addEventListener('pointermove', bouge);
    cv.addEventListener('pointerup', haut);
    cv.addEventListener('pointercancel', haut);
    return () => {
      cancelAnimationFrame(id);
      cv.removeEventListener('pointerdown', bas);
      cv.removeEventListener('pointermove', bouge);
      cv.removeEventListener('pointerup', haut);
      cv.removeEventListener('pointercancel', haut);
    };
  }, []);

  return <canvas ref={toile} className="block w-full h-[320px] touch-none cursor-grab"
                 style={{ background: 'radial-gradient(circle at 50% 40%, #2A2E44, #0A0C18 75%)' }} />;
}

/** Le panneau TENUES de MES COURSES. */
export function TenuesMesCourses() {
  const vest = useVestiaire();
  const [vue, setVue] = React.useState(vest.tenue);
  // Un skin porte habille le joueur a la place de sa tenue, sur ses courses.
  const porte = vest.porte ? null : vest.tenue;

  return (
    <div className="w-full">
      <Repliable
        titre={L(['TENUES', 'OUTFITS'])}
        sous={L(['Ton coureur en grand : choisis sa tenue.', 'Your runner up close: pick an outfit.'])}
        icone={<Shirt className="w-4 h-4" />}
        couleur="text-primary"
        marque={
          <span className="shrink-0 text-[9px] font-bold tracking-widest uppercase text-muted-foreground">
            {porte ? L(TENUES[porte].nom) : L(['skin', 'skin'])}
          </span>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="rounded-2xl overflow-hidden border border-white/10 relative">
            <Apercu cle={vue} />
            <span className="absolute left-3 top-2 font-black font-display text-2xl text-white drop-shadow">
              {L(TENUES[vue].nom)}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(TENUES).map(([cle, t]) => (
              <button key={cle} onClick={() => setVue(cle)}
                      className="rounded-xl border-2 p-2 flex flex-col items-center gap-1"
                      style={{ borderColor: vue === cle ? css(t.shoe) : 'rgba(255,255,255,0.12)',
                               background: '#0E0A1A' }}>
                <span className="flex gap-0.5">
                  <span className="w-3 h-5 rounded-sm" style={{ background: css(t.jersey), outline: '1px solid rgba(255,255,255,0.2)' }} />
                  <span className="w-3 h-5 rounded-sm" style={{ background: css(t.shorts), outline: '1px solid rgba(255,255,255,0.2)' }} />
                  <span className="w-3 h-5 rounded-sm" style={{ background: css(t.shoe), outline: '1px solid rgba(255,255,255,0.2)' }} />
                </span>
                <span className="text-[9px] font-black tracking-widest text-white">{L(t.nom)}</span>
              </button>
            ))}
          </div>
          <button onClick={() => porterTenue(vue)} disabled={porte === vue}
                  className="w-full py-2.5 rounded-xl text-xs font-black tracking-widest"
                  style={porte === vue ? { background: 'rgba(255,255,255,0.12)', color: '#fff' } : { background: '#fff', color: '#000' }}>
            {porte === vue ? L(['PORTÉE', 'WEARING']) : L(['PORTER CETTE TENUE', 'WEAR THIS OUTFIT'])}
          </button>
          <p className="text-[10px] leading-snug text-white/45">
            {L(['Glisse le doigt sur le coureur pour le tourner. La tenue se porte sur toutes les courses.',
                'Drag the runner to turn him. The outfit is worn in every race.'])}
          </p>
        </div>
      </Repliable>
    </div>
  );
}
