// MON AVATAR — le corps du coureur du joueur (game/vestiaire.ts, Avatar), dans MES COURSES.
import { useEffect, useRef, useState } from 'react';
import { UserRound } from 'lucide-react';
import { SprinterApp, SprinterCore, SprinterI18N } from '@/game/engine';
import { POSTURES } from '@/game/athlete/postures';
import { useVestiaire, choisirAvatar, PEAUX, COIFFURES, CHEVEUX, type Avatar } from '@/game/vestiaire';

const dans = (t: [string, string]) => t[SprinterI18N.index()];
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
const NOMS_COIFFURES: Record<string, [string, string]> = {
  crop: ['Court', 'Crop'], fade: ['Dégradé', 'Fade'], shaved: ['Rasé', 'Shaved'], bun: ['Chignon', 'Bun'],
  ponytail: ['Queue de cheval', 'Ponytail'], braids: ['Tresses', 'Braids'], flattop: ['Flat-top', 'Flat-top'],
};

/** Le coureur qui tourne lentement sur lui-meme, dessine par le moteur (corps a facettes). */
function Apercu({ av }: { av: Avatar | null }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const A = SprinterApp as any, haut = 150, dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = Math.round(haut * 0.7 * dpr); cv.height = Math.round(haut * dpr);
    const c = cv.getContext('2d')!;
    // PLAYER_LOOK porte deja l'avatar (vestiaire.ts) : une copie, pour ne rien laisser au dessin
    const corps = { look: { ...SprinterCore.PLAYER_LOOK }, stride: 0, v: 0, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0, marche: 0, marcheT: 0, posture: POSTURES.debout() } as any; // debout, pas en pleine foulee
    let id = 0;
    const tic = (t: number) => {
      c.clearRect(0, 0, cv.width, cv.height);
      const k = cv.height * 0.47, cap = -Math.PI / 2 + Math.sin(t / 1400) * 1.2;
      A.drawFacetFigure(c, A.personCapsules(corps, cap, 0, false, false, A.niveauDetail(k)), cv.width / 2, cv.height * 0.96, k);
      id = requestAnimationFrame(tic);
    };
    id = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(id);
  }, [av]);
  return <canvas ref={ref} style={{ height: 150, width: 105 }} className="block" aria-hidden />;
}

export function MonAvatar() {
  const { avatar } = useVestiaire();
  const [ouvert, setOuvert] = useState(false);
  const L = SprinterCore.PLAYER_LOOK;
  // sans avatar choisi, on part du corps d'origine du joueur
  const av: Avatar = avatar || { corps: 'm', peau: 'ebene', coiffure: 'crop', cheveux: 'noir' };
  const changer = (p: Partial<Avatar>) => choisirAvatar({ ...av, ...p });
  const pastille = (actif: boolean) => `w-8 h-8 rounded-full border-2 ${actif ? 'border-white scale-110' : 'border-white/20'} transition-transform`;
  const titre = 'text-[10px] font-black tracking-[0.22em] text-white/60';
  const bouton = (actif: boolean) => `px-3 py-1.5 rounded-lg text-[11px] font-black tracking-wide ${actif ? 'bg-[#F8CD4A] text-black' : 'bg-white/10 text-white'}`;

  return (
    <div className="w-full bg-card/70 border border-white/10 rounded-2xl p-3 shadow-2xl">
      <button onClick={() => setOuvert(o => !o)} className="w-full flex items-center gap-2 text-left" aria-expanded={ouvert}>
        <UserRound className="w-4 h-4 text-primary" />
        <span className="flex-1 font-black tracking-widest text-sm text-white">{dans(['MON AVATAR', 'MY AVATAR'])}</span>
        <span className="w-5 h-5 rounded-full border border-white/30" style={{ background: rgb(L.skin) }} />
        <span className="text-white/50 text-xs">{ouvert ? '▲' : '▼'}</span>
      </button>
      {ouvert && (
        <div className="mt-3 flex gap-3">
          <div className="shrink-0 rounded-xl bg-gradient-to-b from-[#BFE0F5] to-[#8DBF77] self-start"><Apercu av={avatar} /></div>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex gap-2">
              {(['m', 'f'] as const).map(c => (
                <button key={c} onClick={() => changer({ corps: c })} className={bouton(av.corps === c) + ' flex-1'}>
                  {c === 'f' ? dans(['Fille', 'Girl']) : dans(['Garçon', 'Boy'])}
                </button>
              ))}
            </div>
            <span className={titre}>{dans(['PEAU', 'SKIN'])}</span>
            <div className="flex flex-wrap gap-2">
              {PEAUX.map(p => <button key={p} aria-label={p} onClick={() => changer({ peau: p })} className={pastille(av.peau === p)}
                                      style={{ background: rgb(SprinterCore.SKIN[p]) }} />)}
            </div>
            <span className={titre}>{dans(['COIFFURE', 'HAIR'])}</span>
            <div className="flex flex-wrap gap-2">
              {COIFFURES.map(h => <button key={h} onClick={() => changer({ coiffure: h })} className={bouton(av.coiffure === h)}>{dans(NOMS_COIFFURES[h])}</button>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(CHEVEUX).map(h => <button key={h} aria-label={h} onClick={() => changer({ cheveux: h })} className={pastille(av.cheveux === h)}
                                                    style={{ background: rgb(CHEVEUX[h]) }} />)}
            </div>
            {avatar && (
              <button onClick={() => choisirAvatar(null)} className="self-start text-[11px] text-white/60 underline">
                {dans(['Reprendre le coureur d’origine', 'Back to the original runner'])}
              </button>
            )}
            <p className="text-[10px] leading-snug text-white/45">
              {dans(['Ton coureur sur toutes les courses. Un skin gagné le remplace là où il se porte.',
                     'Your runner in every race. A won skin replaces it where it is worn.'])}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
