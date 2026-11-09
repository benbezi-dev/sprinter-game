// MON AVATAR — le corps du coureur du joueur (game/vestiaire.ts, Avatar), dans MES COURSES.
// Meme facture que le vestiaire (DefiVedette.tsx, SkinsMesCourses) : panneau repliable, carte sombre au liseré or.
import React, { useEffect, useRef } from 'react';
import { UserRound } from 'lucide-react';
import { Repliable } from './Repliable';
import { SprinterApp, SprinterCore, SprinterI18N } from '@/game/engine';
import { charger as chargerMaillage, pret, dessiner } from '@/game/vedette-3d';
import { cheminDe } from '@/game/athlete/corps-gens';
import { useVestiaire, choisirAvatar, PEAUX, COIFFURES, CHEVEUX, type Avatar } from '@/game/vestiaire';

const dans = (t: [string, string]) => t[SprinterI18N.index()];
const rgb = (c: number[]) => `rgb(${c[0]},${c[1]},${c[2]})`;
/** L'or du maillot du joueur (PLAYER_LOOK), comme la carte TON MAILLOT. */
const OR = 'rgb(248, 205, 74)';
/** Le stade de jour : le ciel, la pelouse, la piste bleue. */
const ENCRE = '#14213A', PISTE = '#2D5BD8';
const NOMS_COIFFURES: Record<string, [string, string]> = {
  crop: ['COURT', 'CROP'], fade: ['DÉGRADÉ', 'FADE'], shaved: ['RASÉ', 'SHAVED'], bun: ['CHIGNON', 'BUN'],
  ponytail: ['QUEUE', 'PONYTAIL'], braids: ['TRESSES', 'BRAIDS'], flattop: ['FLAT-TOP', 'FLAT-TOP'],
};

/** Le coureur 3D de la course (Rocketbox), debout, qui tourne lentement ; les facettes tant qu'il charge. */
function Apercu({ av, haut }: { av: Avatar | null; haut: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const A = SprinterApp as any, dpr = Math.min(3, Math.max(2, window.devicePixelRatio || 1));
    cv.width = Math.round(haut * 0.62 * dpr); cv.height = Math.round(haut * dpr);
    const c = cv.getContext('2d')!;
    // PLAYER_LOOK porte deja l'avatar (vestiaire.ts) : une copie, pour ne rien laisser au dessin
    const look = { ...SprinterCore.PLAYER_LOOK } as any;
    look.maillage = cheminDe(look); chargerMaillage(look.maillage);
    // en pleine course, en boucle : debout et bras ballants, le coureur n'a plus rien d'un athlete
    const corps = { look, stride: 0, v: 9, maxSpeed: 12, fallAnim: 0, celebrate: 0, drivePitch: 0 } as any;
    let id = 0, avant = 0;
    const tic = (t: number) => {
      corps.stride += Math.min(0.05, (t - (avant || t)) / 1000) * 2 * Math.PI * 2.2; avant = t; // 2,2 foulees/s
      c.clearRect(0, 0, cv.width, cv.height);
      const k = cv.height * 0.47, cap = -Math.PI / 2 + Math.sin(t / 1600) * 0.45;
      const caps = A.personCapsules(corps, cap, 0, false, false, A.niveauDetail(k));
      if (!(pret(look.maillage) && dessiner(c, look.maillage, corps.squelette || null,
            A.repereDuCoureur(corps, cap, 0, false, false), cv.width / 2, cv.height * 0.97, k, look)))
        A.drawFacetFigure(c, caps, cv.width / 2, cv.height * 0.97, k);
      id = requestAnimationFrame(tic);
    };
    id = requestAnimationFrame(tic);
    return () => cancelAnimationFrame(id);
  }, [av, haut]);
  return <canvas ref={ref} className="block" style={{ height: haut, width: haut * 0.62, filter: 'brightness(1.25)' }} aria-hidden />;
}

/** Un intitulé de rangée, comme les petites capitales du vestiaire. */
const Titre = ({ children }: { children: React.ReactNode }) =>
  <span className="text-[10px] font-black tracking-[0.22em]" style={{ color: PISTE }}>{children}</span>;

/** Une pastille de couleur : liseré or quand elle est choisie. */
function Pastille({ couleur, actif, nom, onClick }: { couleur: number[]; actif: boolean; nom: string; onClick: () => void }) {
  return (
    <button aria-label={nom} aria-pressed={actif} onClick={onClick}
            className="w-8 h-8 rounded-full transition-transform"
            style={{ background: rgb(couleur), boxShadow: actif ? `0 0 0 2px #fff, 0 0 0 4px ${PISTE}` : 'inset 0 0 0 1px rgba(20,33,58,0.2)',
                     transform: actif ? 'scale(1.08)' : undefined }} />
  );
}

/** Un choix en toutes lettres : or quand il est pris, blanc sinon (les boutons PORTER du vestiaire). */
function Choix({ actif, onClick, children, large }: { actif: boolean; onClick: () => void; children: React.ReactNode; large?: boolean }) {
  return (
    <button onClick={onClick} aria-pressed={actif}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-black tracking-widest ${large ? 'flex-1' : ''}`}
            style={actif ? { background: OR, color: '#000', boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.15)' } : { background: '#fff', color: ENCRE, boxShadow: 'inset 0 0 0 1px rgba(20,33,58,0.15)' }}>
      {children}
    </button>
  );
}

export function MonAvatar() {
  const { avatar } = useVestiaire();
  // sans avatar choisi, on part du corps d'origine du joueur
  const av: Avatar = avatar || { corps: 'm', peau: 'ebene', coiffure: 'crop', cheveux: 'noir' };
  const changer = (p: Partial<Avatar>) => choisirAvatar({ ...av, ...p });

  return (
    <div className="w-full">
      <Repliable
        titre={dans(['MON AVATAR', 'MY AVATAR'])}
        sous={dans(['Choisis le corps de ton coureur.', 'Pick your runner’s body.'])}
        icone={<UserRound className="w-4 h-4" />}
        couleur="text-primary"
        marque={<span className="shrink-0 w-6 h-6 rounded-full" style={{ background: rgb(SprinterCore.PLAYER_LOOK.skin), boxShadow: `0 0 0 2px ${OR}` }} />}
      >
        <div className="rounded-2xl border-2 p-3 flex gap-3"
             style={{ borderColor: OR, background: 'linear-gradient(180deg, #EAF5FD, #D8EDD0)' }}>
          <span className="shrink-0 self-start rounded-xl overflow-hidden"
                style={{ background: `linear-gradient(180deg, #BFE0F5 0%, #DDEFF8 55%, #8DBF77 56%, #7AB266 88%, ${PISTE} 88%)`,
                         boxShadow: 'inset 0 0 0 1px rgba(20,33,58,0.15)' }}>
            <Apercu av={avatar} haut={190} />
          </span>
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <span className="font-black font-display text-lg leading-none" style={{ color: ENCRE }}>{dans(['TON COUREUR', 'YOUR RUNNER'])}</span>
            <div className="flex gap-2">
              <Choix large actif={av.corps === 'm'} onClick={() => changer({ corps: 'm' })}>{dans(['GARÇON', 'BOY'])}</Choix>
              <Choix large actif={av.corps === 'f'} onClick={() => changer({ corps: 'f' })}>{dans(['FILLE', 'GIRL'])}</Choix>
            </div>
            <Titre>{dans(['PEAU', 'SKIN'])}</Titre>
            <div className="flex flex-wrap gap-2">
              {PEAUX.map(p => <Pastille key={p} nom={p} couleur={SprinterCore.SKIN[p]} actif={av.peau === p} onClick={() => changer({ peau: p })} />)}
            </div>
            <Titre>{dans(['COIFFURE', 'HAIR'])}</Titre>
            <div className="flex flex-wrap gap-2">
              {COIFFURES.map(h => <Choix key={h} actif={av.coiffure === h} onClick={() => changer({ coiffure: h })}>{dans(NOMS_COIFFURES[h])}</Choix>)}
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.keys(CHEVEUX).map(h => <Pastille key={h} nom={h} couleur={CHEVEUX[h]} actif={av.cheveux === h} onClick={() => changer({ cheveux: h })} />)}
            </div>
            {avatar && (
              <button onClick={() => choisirAvatar(null)}
                      className="self-start mt-1 px-3 py-1.5 rounded-lg text-[11px] font-black tracking-widest text-white" style={{ background: ENCRE }}>
                {dans(['COUREUR D’ORIGINE', 'ORIGINAL RUNNER'])}
              </button>
            )}
          </div>
        </div>
        <p className="mt-2 text-[10px] leading-snug text-white/45">
          {dans(['Sur toutes tes courses. Un skin gagné le remplace là où il se porte.',
                 'In all your races. A won skin replaces it where it is worn.'])}
        </p>
      </Repliable>
    </div>
  );
}
