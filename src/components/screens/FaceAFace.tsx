import './mes-duels.css';
import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Crown, Skull, Swords } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { nomDiscipline } from '@/game/duels';
import { lireFaceAFace, TOUTES, type Adversaire, type FaceAFaceEpreuve } from '@/game/face-a-face';
import { useRetour } from '@/hooks/use-retour';

function Score({ nom, adv, vedette = false }: { nom: string; adv: Adversaire; vedette?: boolean }) {
  const { N } = SprinterApp;
  return (
    <span className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
      <span className="min-w-0 break-words font-bold leading-tight">{nom}</span>
      <strong className={`font-display font-black tabular-nums whitespace-nowrap ${vedette ? 'text-3xl' : 'text-lg'}`}>
        {adv.v}<span className="mx-1 text-muted-foreground">–</span>{adv.d}
      </strong>
      <span className="min-w-0 break-words font-bold leading-tight text-right">{adv.nom}</span>
      {adv.n > 0 && <small className="col-span-3 text-center text-muted-foreground">{N.t(adv.n === 1 ? 'h2h_un_nul' : 'h2h_nuls', { n: adv.n })}</small>}
    </span>
  );
}

export function FaceAFace({ nom, onRetour }: { nom: string; onRetour: () => void }) {
  const { N } = SprinterApp;
  const page = useRef<HTMLDialogElement>(null);
  const [donnees, setDonnees] = useState<FaceAFaceEpreuve[] | null>();
  const [choix, setChoix] = useState(TOUTES);
  const [essai, setEssai] = useState(0);
  const [rival, setRival] = useState<Adversaire | null>(null);
  useRetour(onRetour);
  useRetour(() => setRival(null), rival !== null);

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
      className="fixed inset-0 m-auto h-dvh w-full max-w-none max-h-none bg-background text-foreground pointer-events-auto backdrop:bg-black/75 sm:max-w-lg sm:max-h-[90dvh] sm:rounded-2xl sm:border sm:border-foreground/10">
      <div className="flex h-full flex-col pt-[env(safe-area-inset-top)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]">
        <header className="relative flex shrink-0 items-center justify-center min-h-16 border-b border-foreground/10 px-3">
          <button type="button" onClick={onRetour} className="absolute left-2 flex items-center gap-0.5 rounded-lg px-2 min-h-11 text-xs font-bold hover:bg-secondary">
            <ChevronLeft className="size-4" />{N.t('prof_titre')}
          </button>
          <h2 id="mes-duels-titre" className="duel-affiche-titre text-primary">{N.t('h2h_titre')}</h2>
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
              [Skull, 'h2h_bete_noire', ep.bete_noire, 'h2h_pas_bete_noire', 'text-foreground'],
              [Crown, 'h2h_victime', ep.victime_favorite, 'h2h_pas_victime', 'text-primary'],
            ] as const).map(([Icone, titre, adv, vide, couleur]) => (
              <section key={titre} className="duel-affrontement relative px-4 py-3">
                <h3 className={`mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-widest ${couleur}`}>
                  <Icone className="size-4" />{N.t(titre)}{adv && <ChevronRight className="ml-auto size-4" />}
                </h3>
                {adv ? <button type="button" aria-haspopup="dialog" onClick={() => setRival(adv)}
                  aria-label={N.t(titre) + ' · ' + nom + ' ' + adv.v + ' – ' + adv.d + ' ' + adv.nom}
                  className="absolute inset-0 z-10 hover:bg-foreground/5 focus-visible:outline-primary" /> : null}
                {adv ? <Score nom={nom} adv={adv} vedette /> : <p className="text-sm text-muted-foreground">{N.t(vide)}</p>}
              </section>
            ))}
            <section>
              <h3 className="mb-2 border-l-4 border-primary pl-2 text-xs font-black uppercase tracking-widest">{N.t('h2h_tous', { n: ep.adversaires.length })}</h3>
              <ul className="divide-y divide-foreground/10 rounded-xl bg-secondary/40">
                {ep.adversaires.map((adv, i) => <li key={i}>
                  <button type="button" onClick={() => setRival(adv)} aria-haspopup="dialog"
                    className="flex min-h-11 w-full items-center gap-1 rounded-lg px-3 py-2 text-left text-sm hover:bg-foreground/5 focus-visible:outline-primary">
                    <span className="flex-1 min-w-0"><Score nom={nom} adv={adv} /></span>
                    <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
                  </button>
                </li>)}
              </ul>
            </section>
          </>}
        </div>
      </div>
      {rival && ep && <FicheRival nom={nom} adv={rival} epreuve={ep.epreuve} onRetour={() => setRival(null)} />}
    </dialog>
  );
}

function FicheRival({ nom, adv, epreuve, onRetour }: {
  nom: string; adv: Adversaire; epreuve: string; onRetour: () => void;
}) {
  const { N } = SprinterApp;
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogue = ref.current!;
    dialogue.showModal();
    return () => dialogue.close();
  }, []);
  const total = adv.v + adv.d + adv.n;
  return (
    <dialog ref={ref} aria-labelledby="titre-rival" onCancel={e => {
      e.preventDefault();
      e.stopPropagation();
      onRetour();
    }} className="fixed inset-0 m-auto w-[calc(100%-2rem)] max-w-md max-h-[90dvh] overflow-y-auto rounded-xl border border-primary/40 bg-card text-foreground shadow-2xl backdrop:bg-black/80">
      <header className="flex items-center justify-between gap-2 border-b border-foreground/10 px-3 py-1.5">
        <button type="button" onClick={onRetour} className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-bold hover:bg-secondary">
          <ChevronLeft className="size-4" />{N.t('h2h_titre')}
        </button>
        <span className="pr-2 text-xs font-bold text-muted-foreground">{epreuve === TOUTES ? N.t('h2h_ensemble') : nomDiscipline(epreuve)}</span>
      </header>
      <div className="border-b border-primary/20 bg-background px-4 py-5">
        <h3 id="titre-rival" className="mb-4 flex items-center gap-2 font-display font-black italic uppercase text-primary">
          <Swords className="size-4" />{N.t('h2h_fiche')}<span className="sr-only"> · {nom} / {adv.nom}</span>
        </h3>
        <div className="[&_strong]:text-primary"><Score nom={nom} adv={adv} vedette /></div>
        <p className="mt-4 text-center text-xs text-muted-foreground">{N.t(total === 1 ? 'h2h_match' : 'h2h_matchs', { n: total })}</p>
      </div>
      <dl className="mx-4 my-3 grid grid-cols-3 divide-x divide-foreground/15 py-2 text-center">
        {([['h2h_gagnes', adv.v], ['h2h_egaux', adv.n], ['h2h_perdus', adv.d]] as const).map(([label, valeur]) => (
          <div key={label}>
            <dt className="text-xs text-muted-foreground">{N.t(label)}</dt>
            <dd className="font-display text-xl font-black tabular-nums">{valeur}</dd>
          </div>
        ))}
      </dl>
    </dialog>
  );
}
