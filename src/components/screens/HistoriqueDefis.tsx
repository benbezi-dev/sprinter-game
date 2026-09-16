import React, { useEffect, useState } from 'react';
import { Swords, Radio, Loader2, History } from 'lucide-react';
import { SprinterApp } from '@/game/engine';
import { defierDepuisClassement } from '@/game/duels';
import {
  lireJournal, surJournal, type EntreeDefi, type EtatDefi,
} from '@/game/journal-defis';
import { Repliable } from './Repliable';
import { TOUTES_LES_EPREUVES, nomEnLigne } from '@/game/jeux';

const RACE_KEYS: readonly string[] = TOUTES_LES_EPREUVES;

/**
 * LE JOURNAL DES DEFIS, DEROULABLE DANS MES COURSES.
 *
 * Ce qui manquait n'etait pas une liste de plus : c'etait le chemin du retour.
 * Quelqu'un nous defie, on n'est pas la ; quelqu'un nous invite a courir en
 * direct, le telephone est dans une poche. Le lendemain il ne reste rien —
 * ni le nom, ni l'epreuve, ni meme le souvenir qu'on nous avait cherche. Ces
 * gens-la sont pourtant les seuls dont on sait deja qu'ils veulent courir
 * contre nous.
 *
 * Le panneau les remet donc devant, avec un bouton qui ne sert qu'a ca :
 * repartir dans l'autre sens. Il est REPLIE par defaut — MES COURSES est
 * d'abord l'ecran de ses chronos — mais il compte ce qui attend sur son
 * titre, pour qu'un panneau replie ne devienne pas un panneau oublie.
 *
 * UNE SEMAINE. Le module qui tient le journal efface au-dela, et le panneau
 * le dit en toutes lettres plutot que de laisser croire a une archive.
 */
export function HistoriqueDefis({ race, onDefier }: {
  /** L'epreuve ouverte au classement : celle d'un defi sans epreuve connue. */
  race: string;
  /** Fermer le classement. La course part ensuite, sur l'ecran qu'il couvrait. */
  onDefier: () => void;
}) {
  const { N } = SprinterApp;
  const [lignes, setLignes] = useState<EntreeDefi[]>(() => lireJournal());
  const [enCours, setEnCours] = useState<string | null>(null);

  // Trois reveils, et chacun rattrape ce que les autres ne voient pas : une
  // ecriture pendant qu'on regarde (un defi qui arrive), le retour sur
  // l'ecran, et le simple passage du temps — une invitation en direct expire
  // sans que personne n'ecrive quoi que ce soit.
  useEffect(() => {
    const relire = () => setLignes(lireJournal());
    const off = surJournal(relire);
    const t = setInterval(relire, 30000);
    relire();
    return () => { off(); clearInterval(t); };
  }, []);

  const aRelever = lignes.filter(e => e.sens === 'recu' && e.etat === 'attente');
  const manques  = lignes.filter(e => e.etat === 'manque');
  const reste    = lignes.filter(e => !aRelever.includes(e) && !manques.includes(e));

  const defier = async (e: EntreeDefi) => {
    const nom = e.nom.trim();
    if (!nom || enCours) return;
    setEnCours(e.cle);
    try {
      // L'epreuve du defi d'origine, quand on la connait : rendre un 400 m
      // par un 100 m n'est pas une revanche. Sinon celle qu'on regarde.
      const eps = e.epreuves.filter(k => RACE_KEYS.includes(k));
      const { cible } = await defierDepuisClassement(nom, eps.length ? eps : [race]);
      SprinterApp.G.defiSansCible = !cible ? nom : null;
      onDefier();
    } catch {
      setEnCours(null);
    }
  };

  const quand = (t: number) => new Date(t).toLocaleDateString(
    N.getLang() === 'fr' ? 'fr-FR' : 'en-GB',
    { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  /** Ce que la ligne raconte, en une phrase. */
  const phrase = (e: EntreeDefi) => {
    const n = e.nom.trim();
    if (!n) return e.sens === 'lance' ? N.t('jd_l_anonyme') : N.t('jd_sans_nom');
    if (e.genre === 'direct') {
      return N.t(e.sens === 'recu' ? 'jd_l_recu_live' : 'jd_l_lance_live', { n });
    }
    return N.t(e.sens === 'recu' ? 'jd_l_recu' : 'jd_l_lance', { n });
  };

  const TEINTE: Record<EtatDefi, string> = {
    attente: 'text-primary border-primary/40 bg-primary/10',
    manque:  'text-orange-300 border-orange-400/30 bg-orange-400/10',
    releve:  'text-muted-foreground border-white/10 bg-white/5',
    gagne:   'text-emerald-300 border-emerald-400/30 bg-emerald-400/10',
    perdu:   'text-red-300 border-red-400/30 bg-red-400/10',
    nul:     'text-slate-300 border-white/15 bg-white/5',
  };
  const MOT: Record<EtatDefi, string> = {
    attente: 'jd_e_attente', manque: 'jd_e_manque', releve: 'jd_e_releve',
    gagne: 'jd_e_gagne', perdu: 'jd_e_perdu', nul: 'jd_e_nul',
  };

  // Des fonctions, pas des composants : declares dans le rendu, ils seraient
  // remontes a chaque passage, et une liste qui se remonte perd le focus sous
  // le doigt de celui qui la parcourt.
  const ligne = (e: EntreeDefi) => (
    <div key={e.cle}
         className="flex items-center gap-2 px-3 py-2 rounded-xl border border-white/5 bg-black/20">
      <span className={`shrink-0 ${e.genre === 'direct' ? 'text-emerald-400' : 'text-primary/70'}`}>
        {e.genre === 'direct'
          ? <Radio className="w-3.5 h-3.5" />
          : <Swords className="w-3.5 h-3.5" />}
      </span>
      <div className="flex flex-col min-w-0 flex-1">
        <span className="text-[11px] md:text-xs font-bold text-foreground truncate">
          {phrase(e)}
        </span>
        <span className="text-[9px] md:text-[10px] text-muted-foreground/80 truncate">
          {quand(e.at)}
          {e.epreuves.length ? ` · ${nomEnLigne(e.epreuves)}` : ''}
          {/* Les points ne s'affichent que s'il y en a eu : un duel nul en
              rapporte zero, et « +0 LP » se lit comme une panne. */}
          {e.lp ? ` · ${e.lp > 0 ? '+' : ''}${e.lp} LP` : ''}
        </span>
      </div>
      <span className={`shrink-0 text-[9px] font-bold tracking-widest uppercase
                        px-2 py-1 rounded-lg border ${TEINTE[e.etat]}`}>
        {N.t(MOT[e.etat])}
      </span>
      {/* Le bouton du retour. Il n'a de sens que si l'on sait qui defier :
          un code parti sans destinataire n'a personne au bout. */}
      {!!e.nom.trim() && (
        <button
          onClick={() => defier(e)}
          disabled={!!enCours}
          title={`${N.t('jd_redefier')} — ${e.nom}`}
          aria-label={`${N.t('jd_redefier')} ${e.nom}`}
          className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                     text-primary/70 border border-primary/30 hover:bg-primary/15
                     hover:text-primary disabled:opacity-40 transition-colors"
        >
          {enCours === e.cle
            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
            : <Swords className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );

  const section = (titre: string, items: EntreeDefi[]) => (
    items.length === 0 ? null : (
      <div key={titre} className="flex flex-col gap-1.5">
        <span className="text-[9px] font-bold tracking-widest text-muted-foreground uppercase px-1">
          {titre}
        </span>
        {items.map(ligne)}
      </div>
    )
  );

  return (
    <div className="w-full">
      <Repliable
        titre={N.t('jd_title')}
        sous={N.t('jd_sub')}
        icone={<History className="w-4 h-4" />}
        couleur="text-primary"
        marque={aRelever.length > 0 ? (
          <span className="shrink-0 text-[9px] font-bold tracking-widest uppercase
                           px-2 py-1 rounded-lg bg-primary text-background">
            {N.t('jd_a_relever', { n: aRelever.length })}
          </span>
        ) : undefined}
      >
        {lignes.length === 0 ? (
          <p className="text-center text-xs text-muted-foreground py-3">{N.t('jd_vide')}</p>
        ) : (
          <div className="flex flex-col gap-3 max-h-[50vh] overflow-y-auto overscroll-contain pr-1">
            {section(N.t('jd_recus'), aRelever)}
            {section(N.t('jd_manques'), manques)}
            {section(N.t('jd_histoire'), reste)}
          </div>
        )}
        <p className="text-[9px] md:text-[10px] text-muted-foreground/70 leading-snug
                      pt-2 border-t border-white/10">
          {N.t('jd_note')}
        </p>
      </Repliable>
    </div>
  );
}
