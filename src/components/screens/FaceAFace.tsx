import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, Crown, Skull } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { nomDiscipline } from '@/game/duels';
import { lireFaceAFace, TOUTES, type Adversaire, type FaceAFaceEpreuve } from '@/game/face-a-face';
import { useRetour } from '@/hooks/use-retour';

function Score({ nom, adv, vedette = false }: { nom: string; adv: Adversaire; vedette?: boolean }) {
  const { N } = SprinterApp;
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
      <span className="min-w-0 break-words font-bold leading-tight">{nom}</span>
      <strong className={`font-display font-black tabular-nums whitespace-nowrap ${vedette ? 'text-3xl' : 'text-lg'}`}>
        {adv.v}<span className="mx-1 text-muted-foreground">–</span>{adv.d}
      </strong>
      <span className="min-w-0 break-words font-bold leading-tight text-right">{adv.nom}</span>
      {adv.n > 0 && <small className="col-span-3 text-center text-muted-foreground">{N.t(adv.n === 1 ? 'h2h_un_nul' : 'h2h_nuls', { n: adv.n })}</small>}
    </div>
  );
}

export function FaceAFace({ nom, onRetour }: { nom: string; onRetour: () => void }) {
  const { N } = SprinterApp;
  const page = useRef<HTMLDialogElement>(null);
  const [donnees, setDonnees] = useState<FaceAFaceEpreuve[] | null>();
  const [choix, setChoix] = useState(TOUTES);
  const [essai, setEssai] = useState(0);
  useRetour(onRetour);

  useEffect(() => {
    const dialogue = page.current!;
    dialogue.showModal();
    return () => dialogue.close();
  }, []);

  useEffect(() => {
    let actif = true;
    setDonnees(undefined);
    lireFaceAFace(nom).then(d => { if (actif) setDonnees(d); });
    return () => { actif = false; };
  }, [nom, essai]);

  const ep = donnees?.find(e => e.epreuve === choix) ?? donnees?.[0];

  return (
    <dialog ref={page} aria-labelledby="mes-duels-titre"
      onClick={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); onRetour(); }}
      className="fixed inset-0 m-auto h-dvh w-full max-w-none max-h-none bg-background text-foreground pointer-events-auto backdrop:bg-black/75 sm:max-w-lg sm:max-h-[90dvh] sm:rounded-2xl sm:border sm:border-white/10">
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <header className="relative flex shrink-0 items-center justify-center min-h-16 border-b border-white/10 px-3">
          <button type="button" onClick={onRetour} className="absolute left-2 flex items-center gap-0.5 rounded-lg px-2 min-h-11 text-xs font-bold hover:bg-secondary">
            <ChevronLeft className="size-4" />{N.t('prof_titre')}
          </button>
          <h2 id="mes-duels-titre" className="font-display font-black text-2xl uppercase text-primary">{N.t('h2h_titre')}</h2>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-4">
          {!ep && <div role="status" className="text-sm text-muted-foreground">
            {N.t(donnees === undefined ? 'h2h_charge' : donnees === null ? 'h2h_erreur' : 'h2h_vide')}
            {donnees === null && <button type="button" onClick={() => setEssai(i => i + 1)} className="block py-3 text-primary font-bold">{N.t('h2h_reessayer')}</button>}
          </div>}
          {ep && donnees && <>
            <div className="flex flex-wrap gap-1.5">
              {donnees.map(e => (
                <button key={e.epreuve} type="button" onClick={() => setChoix(e.epreuve)} aria-pressed={e.epreuve === ep.epreuve}
                  className="rounded-lg px-3 py-2 text-xs font-bold bg-secondary aria-pressed:bg-primary aria-pressed:text-background">
                  {e.epreuve === TOUTES ? N.t('h2h_toutes') : nomDiscipline(e.epreuve)}
                </button>
              ))}
            </div>
            {([
              [Skull, 'h2h_bete_noire', ep.bete_noire, 'h2h_pas_bete_noire', 'text-red-300'],
              [Crown, 'h2h_victime', ep.victime_favorite, 'h2h_pas_victime', 'text-primary'],
            ] as const).map(([Icone, titre, adv, vide, couleur]) => (
              <section key={titre} className="rounded-xl border border-white/10 bg-card px-4 py-3">
                <h3 className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${couleur}`}>
                  <Icone className="size-4" />{N.t(titre)}
                </h3>
                {adv ? <Score nom={nom} adv={adv} vedette /> : <p className="text-sm text-muted-foreground">{N.t(vide)}</p>}
              </section>
            ))}
            <section>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">{N.t('h2h_tous', { n: ep.adversaires.length })}</h3>
              <ul className="divide-y divide-white/10 rounded-xl bg-secondary/40">
                {ep.adversaires.map((adv, i) => <li key={i} className="px-3 py-2 text-sm"><Score nom={nom} adv={adv} /></li>)}
              </ul>
            </section>
          </>}
        </div>
      </div>
    </dialog>
  );
}
