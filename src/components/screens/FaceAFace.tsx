import React, { useEffect, useState } from 'react';
import { Skull, Crown, ChevronDown, Swords } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { nomDiscipline } from '@/game/duels';
import { lireFaceAFace, formatBilan, TOUTES, type FaceAFaceEpreuve, type Adversaire } from '@/game/face-a-face';

/**
 * Les face-a-face, dans le profil : par epreuve (et toutes epreuves), la bete
 * noire — celui contre qui on perd le plus — et la victime favorite — celui
 * contre qui on gagne le plus —, puis le tableau complet, a deplier.
 */
export function FaceAFace({ nom }: { nom: string }) {
  const { N } = SprinterApp;
  const lang = N.getLang();
  const [donnees, setDonnees] = useState<FaceAFaceEpreuve[] | null | undefined>(undefined);
  const [choix, setChoix] = useState<string>(TOUTES);
  const [deplie, setDeplie] = useState(false);

  useEffect(() => {
    let vivant = true;
    setDonnees(undefined);
    lireFaceAFace(nom).then(d => { if (vivant) setDonnees(d); });
    return () => { vivant = false; };
  }, [nom]);

  if (donnees === undefined) return null;             // chargement : pas de saut de mise en page
  if (donnees === null) return null;                  // hors ligne : la section se tait

  const titre = (
    <span className="text-[10px] font-bold uppercase tracking-widest text-primary flex items-center gap-1.5">
      <Swords className="w-3.5 h-3.5" />{N.t('h2h_titre')}
    </span>
  );
  if (!donnees.length) {
    return (
      <div className="flex flex-col gap-1.5">
        {titre}
        <p className="text-[11px] text-muted-foreground px-0.5">{N.t('h2h_vide')}</p>
      </div>
    );
  }

  const ep = donnees.find(e => e.epreuve === choix) || donnees[0];
  const libelle = (cle: string) => (cle === TOUTES ? N.t('h2h_toutes') : nomDiscipline(cle));

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 px-0.5">
        {titre}
        <span className="text-[11px] text-muted-foreground tabular-nums">{formatBilan(ep.bilan, lang)}</span>
      </div>

      {/* Le choix de l'epreuve : seulement celles ou l'on a deja un duel tranche. */}
      {donnees.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5 -mx-0.5 px-0.5">
          {donnees.map(e => (
            <button key={e.epreuve} type="button" onClick={() => setChoix(e.epreuve)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-bold whitespace-nowrap transition-colors
                      ${e.epreuve === ep.epreuve ? 'bg-primary text-background' : 'bg-secondary/60 hover:bg-secondary'}`}>
              {libelle(e.epreuve)}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Encart icone={<Skull className="w-4 h-4" />} titre={N.t('h2h_bete_noire')} adv={ep.bete_noire}
               vide={N.t('h2h_pas_bete_noire')} lang={lang} ton="text-red-300" />
        <Encart icone={<Crown className="w-4 h-4" />} titre={N.t('h2h_victime')} adv={ep.victime_favorite}
               vide={N.t('h2h_pas_victime')} lang={lang} ton="text-primary" />
      </div>

      <button type="button" onClick={() => setDeplie(v => !v)} aria-expanded={deplie}
              className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-bold text-muted-foreground hover:text-foreground">
        {N.t('h2h_tous', { n: ep.adversaires.length })}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${deplie ? 'rotate-180' : ''}`} />
      </button>
      {deplie && (
        <div className="rounded-xl bg-secondary/40 divide-y divide-white/5">
          {ep.adversaires.map((a, i) => (
            <div key={i} className="flex items-center gap-2 px-3 py-1.5 text-xs">
              <span className="flex-1 min-w-0 truncate font-bold">{a.nom}</span>
              <span className="tabular-nums text-muted-foreground">{formatBilan(a, lang)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Encart({ icone, titre, adv, vide, lang, ton }: {
  icone: React.ReactNode; titre: string; adv: Adversaire | null; vide: string; lang: string; ton: string;
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-secondary/50 px-3 py-2.5 min-w-0">
      <span className={`flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest ${ton}`}>
        {icone}{titre}
      </span>
      {adv ? (
        <>
          <span className="font-black text-sm truncate">{adv.nom}</span>
          <span className="text-[11px] tabular-nums text-muted-foreground">{formatBilan(adv, lang)}</span>
        </>
      ) : (
        <span className="text-[11px] text-muted-foreground leading-snug">{vide}</span>
      )}
    </div>
  );
}
